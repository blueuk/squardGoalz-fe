import { calculatePositionScores } from './positionUtils';

export interface ArrangeParticipant {
  member_uid: string;
  member_name: string;
  scores: Array<{ score_cd: string; score_val: string | number }>;
}

export interface ArrangedMember {
  member_uid: string;
  member_name: string;
  merc_yn: 'Y' | 'N';
  team_no: number;      // 1부터 시작
  keeper_order: number; // 팀 내 1..팀인원 랜덤 순번
  position?: string;    // 필드 포지션 중 최고 포지션 (용병은 없음)
  fixed?: boolean;      // 미리 팀을 지정한 선수 (미리보기 표시용, 저장하지 않음)
}

// 미리 지정한 선수의 팀: member_uid -> team_no
export type FixedTeams = Record<string, number>;

// 이전 배정 결과의 한 행 (미리보기 또는 저장된 경기)
export interface HistoryRow {
  member_uid: string;
  team_no?: number | null;
}

// 지난 경기 배정 이력의 한 행
export interface PastArrangeRow extends HistoryRow {
  vote_seq: number;
  play_date?: string | null;
}

export interface ArrangeOptions {
  mercCount: number; // 용병 수 (기본 0)
  teamCount: number; // 팀 수 (2~4)
  teamSize: number;  // 팀당 정원 (4~6)
  recent?: HistoryRow[][];          // 방금 본 결과들 (최근부터): 리롤이면 직전 미리보기, 다시 배정이면 저장된 배정
  pastMatches?: PastArrangeRow[][]; // 지난 경기 배정 (최근 경기부터)
  fixed?: FixedTeams; // 미리 지정한 선수는 그 팀에 고정하고 나머지만 배정
}

export const MAX_TEAM_COUNT = 4;
export const MIN_TEAM_SIZE = 4;
export const MAX_TEAM_SIZE = 6;

const CANDIDATE_COUNT = 500;  // 만들어 볼 후보 조합 수 (절반은 직전 팀원을 흩어 놓고 시작)
const ACE_RATIO = 1 / 3;      // 상위 이 비율을 에이스로 보고 먼저 고르게 나눔
const MAX_SWAP_STEPS = 10;    // 후보당 선수 맞교환 최대 횟수
const SWAP_TARGET_GAP = 1.5;  // 맞교환은 팀 평균 전력 차가 이 안에 들어오면 멈춤 (100점 기준)
// 이번 참석자로 만들 수 있는 최선의 전력 차 + 이 값까지 허용
// (2팀은 흩어 놓을 여지가 적어 여유를 더 줌)
const balanceSlack = (teamCount: number) => (teamCount === 2 ? 1.0 : 0.5);
const HISTORY_WEIGHTS = [1, 0.5, 0.25]; // 최근 결과일수록 같은 팀 재회에 큰 벌점 (최근 3개)
const TOP_BOTTOM_WEIGHT = 5;  // 최상위·최하위 선수가 다시 같은 팀이면 일반 쌍의 이만큼 벌점
const SCATTER_SLACK = 1;      // 재회 점수 최솟값 + 이 값 안의 조합 중에서 랜덤 선택
const MIN_FINAL_POOL = 3;     // 최종 랜덤 선택 후보 최소 수 (결과가 한 조합으로 굳지 않도록)

// 골레이로는 팀원이 돌아가며 맡으므로 전력·포지션 조건에서 제외
const DEFENSE_POSITIONS = ['FIX'];
const ATTACK_POSITIONS = ['ALA', 'PIV'];
const TOP_POSITION_COUNT = 2; // 포지션 조건에는 2순위까지 인정

interface Player {
  member_uid: string;
  member_name: string;
  power: number;
  positions: string[]; // 필드 포지션 점수 내림차순 상위
}

interface Candidate {
  teams: Player[][];
  gap: number;
  covered: boolean;
}

const shuffle = <T,>(arr: T[], rand: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

const pickRandom = <T,>(arr: T[], rand: () => number): T => arr[Math.floor(rand() * arr.length)];

const toPlayer = (p: ArrangeParticipant, weights: Record<string, Record<string, number>>, rand: () => number): Player => {
  // 동점 포지션 순서가 한쪽으로 고정되지 않도록 먼저 섞음
  const fieldScores = shuffle(calculatePositionScores(p.scores, weights).filter(r => r.code !== 'GOL'), rand)
    .sort((a, b) => b.score - a.score);
  return {
    member_uid: p.member_uid,
    member_name: p.member_name,
    power: fieldScores[0]?.score ?? 0,
    positions: fieldScores.slice(0, TOP_POSITION_COUNT).map(r => r.code),
  };
};

const teamAverage = (team: Player[]) => average(team.map(p => p.power));

const powerGap = (teams: Player[][]) => {
  const powers = teams.filter(t => t.length > 0).map(teamAverage);
  return powers.length > 0 ? Math.max(...powers) - Math.min(...powers) : 0;
};

const smallestTeams = (teams: Player[][]) => {
  const minSize = Math.min(...teams.map(t => t.length));
  return teams.filter(t => t.length === minSize);
};

// 전력이 가장 높은 팀과 낮은 팀의 같은 그룹(에이스/나머지) 선수를 맞바꿔 목표 범위까지 전력 차를 줄임
// (교환은 개선되는 것 중 랜덤: 최선만 고르면 전력 차가 큰 참석자 구성에서 모든 후보가 한 조합으로 수렴함)
// 미리 지정한 선수는 교환하지 않음
const balanceTeams = (teams: Player[][], aces: Set<string>, fixed: FixedTeams, rand: () => number) => {
  for (let step = 0; step < MAX_SWAP_STEPS; step++) {
    const gap = powerGap(teams);
    if (gap <= SWAP_TARGET_GAP) return;
    const filled = teams.filter(t => t.length > 0).sort((a, b) => teamAverage(b) - teamAverage(a));
    const high = filled[0];
    const low = filled[filled.length - 1];

    const swaps: { a: number; b: number; gap: number }[] = [];
    high.forEach((pa, a) => low.forEach((pb, b) => {
      if (aces.has(pa.member_uid) !== aces.has(pb.member_uid)) return;
      if (fixed[pa.member_uid] !== undefined || fixed[pb.member_uid] !== undefined) return;
      [high[a], low[b]] = [pb, pa];
      swaps.push({ a, b, gap: powerGap(teams) });
      [high[a], low[b]] = [pa, pb];
    }));
    const improving = swaps.filter(s => s.gap < gap);
    if (improving.length === 0) return;

    const passing = improving.filter(s => s.gap <= SWAP_TARGET_GAP);
    const swap = pickRandom(passing.length > 0 ? passing : improving, rand);
    [high[swap.a], low[swap.b]] = [low[swap.b], high[swap.a]];
  }
};

// 미리 지정한 선수를 먼저 넣고 남은 선수 목록을 돌려줌
const startTeams = (players: Player[], teamCount: number, fixed: FixedTeams) => {
  const teams: Player[][] = Array.from({ length: teamCount }, () => []);
  const free = players.filter(p => {
    const team = teams[fixed[p.member_uid] - 1];
    if (team) team.push(p);
    return !team;
  });
  return { teams, free };
};

const acesOf = (players: Player[]) => {
  const ranked = [...players].sort((a, b) => b.power - a.power);
  return new Set(ranked.slice(0, Math.floor(ranked.length * ACE_RATIO)).map(p => p.member_uid));
};

// 에이스는 에이스가 적은 팀부터, 나머지는 인원이 적은 팀부터 랜덤으로 나눔
// (지정 선수가 한 팀에 몰린 경우가 아니면 팀 인원 차이는 1명 이내)
const buildTeams = (players: Player[], teamCount: number, fixed: FixedTeams, aces: Set<string>, rand: () => number) => {
  const { teams, free } = startTeams(shuffle(players, rand), teamCount, fixed);
  const acesIn = (team: Player[]) => team.filter(p => aces.has(p.member_uid)).length;
  for (const player of free.filter(p => aces.has(p.member_uid))) {
    const minAces = Math.min(...teams.map(acesIn));
    pickRandom(smallestTeams(teams.filter(t => acesIn(t) === minAces)), rand).push(player);
  }
  for (const player of free.filter(p => !aces.has(p.member_uid))) {
    pickRandom(smallestTeams(teams), rand).push(player);
  }
  return teams;
};

// 직전 결과의 같은 팀 선수들을 새 팀에 골고루 흩어 놓고 시작 (같은 출신이 적은 팀 > 인원이 적은 팀 순)
const buildScatteredTeams = (players: Player[], teamCount: number, fixed: FixedTeams, lastTeamOf: Map<string, number | undefined>, rand: () => number) => {
  const { teams, free } = startTeams(shuffle(players, rand), teamCount, fixed);
  const fromSameTeam = (team: Player[], prevTeam: number | undefined) =>
    prevTeam === undefined ? 0 : team.filter(p => lastTeamOf.get(p.member_uid) === prevTeam).length;
  // 팀 인원 차이 1명 이내: 기본 인원(base)까지는 자유롭게, base+1은 나머지 인원(extra)만큼의 팀만
  const base = Math.floor(players.length / teamCount);
  const extra = players.length % teamCount;
  // 전력이 높은 선수부터 놓아 에이스도 함께 흩어지게 함
  for (const player of [...free].sort((a, b) => b.power - a.power)) {
    const prevTeam = lastTeamOf.get(player.member_uid);
    const bigTeams = teams.filter(t => t.length > base).length;
    const allowed = teams.filter(t => t.length < base || (t.length === base && bigTeams < extra));
    const open = allowed.length > 0 ? allowed : smallestTeams(teams);
    const minSame = Math.min(...open.map(t => fromSameTeam(t, prevTeam)));
    pickRandom(smallestTeams(open.filter(t => fromSameTeam(t, prevTeam) === minSame)), rand).push(player);
  }
  return teams;
};

// 팀 순서·팀 내 순서와 무관한 조합 식별값 (같은 조합 중복 제거용)
const teamsSignature = (teams: Player[][]) =>
  teams.map(t => t.map(p => p.member_uid).sort().join(',')).sort().join('|');

const evaluate = (teams: Player[][]): Candidate => {
  const hasPosition = (team: Player[], codes: string[]) => team.some(p => p.positions.some(c => codes.includes(c)));
  return {
    teams,
    gap: powerGap(teams),
    covered: teams.every(t => hasPosition(t, DEFENSE_POSITIONS) && hasPosition(t, ATTACK_POSITIONS)),
  };
};

const teamMap = (rows: HistoryRow[]) => new Map(rows.map(r => [r.member_uid, r.team_no ?? undefined]));

// 최상위·최하위 선수 (전력이 모두 같으면 null)
const topAndBottom = (players: Player[]): [string, string] | null => {
  if (players.length < 2) return null;
  const ranked = [...players].sort((a, b) => b.power - a.power);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  return top.power === bottom.power ? null : [top.member_uid, bottom.member_uid];
};

// 두 선수가 함께 있던 가장 최근 결과에서 같은 팀이었는지
const wereTogetherLastTime = ([a, b]: [string, string], history: HistoryRow[][]) => {
  for (const rows of history) {
    const teams = teamMap(rows);
    if (teams.get(a) !== undefined && teams.get(b) !== undefined) return teams.get(a) === teams.get(b);
  }
  return false;
};

// 이력에서 같은 팀이었던 쌍이 다시 같은 팀이 된 정도 (최근 결과일수록 크게, 최상위·최하위 쌍은 더 크게)
const reunionScore = (teams: Player[][], history: HistoryRow[][], topBottom: [string, string] | null) => {
  const maps = history.map(teamMap);
  let score = 0;
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const a = team[i].member_uid;
        const b = team[j].member_uid;
        const pairWeight = topBottom && topBottom.includes(a) && topBottom.includes(b) ? TOP_BOTTOM_WEIGHT : 1;
        maps.forEach((m, h) => {
          const ta = m.get(a);
          if (ta !== undefined && ta === m.get(b)) score += HISTORY_WEIGHTS[h] * pairWeight;
        });
      }
    }
  }
  return score;
};

// 배정 이력을 현재 일정 이전 경기만 경기별로 묶어 최근 경기부터 정렬
export function groupPastMatches(rows: PastArrangeRow[], playDate: string, voteSeq: number): PastArrangeRow[][] {
  const matches = new Map<number, PastArrangeRow[]>();
  rows
    .filter(r => r.play_date && (r.play_date < playDate || (r.play_date === playDate && r.vote_seq < voteSeq)))
    .forEach(r => matches.set(r.vote_seq, [...(matches.get(r.vote_seq) ?? []), r]));
  return [...matches.values()].sort((a, b) =>
    (b[0].play_date as string).localeCompare(a[0].play_date as string) || b[0].vote_seq - a[0].vote_seq
  );
}

// 팀 수·정원이 바뀌면 그 안에 들어가지 않는 미리 지정을 해제
export function trimFixedTeams(fixed: FixedTeams, teamCount: number, teamSize: number): FixedTeams {
  const counts: Record<number, number> = {};
  return Object.fromEntries(Object.entries(fixed).filter(([, teamNo]) => {
    counts[teamNo] = (counts[teamNo] ?? 0) + 1;
    return teamNo <= teamCount && counts[teamNo] <= teamSize;
  }));
}

/**
 * 팀 배정: 우선순위 = 고정 선수 > 포지션 구성 > 그날 가능한 최선의 밸런스 > 최대한 흩어짐 > 무작위
 * 1. 비교 기준: 방금 본 결과(리롤이면 직전 미리보기 최근 3개, 다시 배정이면 저장된 배정)와 지난 경기
 * 2. 후보 생성: 절반은 에이스를 고르게 나눠서, 절반은 직전 팀원을 흩어 놓고 시작해
 *    같은 그룹끼리 맞바꿔 전력 차를 줄임 (미리 지정한 선수는 고정, 중복 제거)
 * 3. 팀마다 수비·공격 포지션이 있는 조합만 남김
 *    최상위·최하위 선수가 지난번 같은 팀이었으면 이번에는 분리
 * 4. 이번 참석자로 만든 최선의 전력 차 + 여유(2팀 1.0점, 3팀 이상 0.5점) 이내 조합만 남김
 * 5. 이력에서 같은 팀이었던 쌍이 가장 적게 다시 만나는 조합들 중 랜덤 선택
 *    (조건을 만족하는 조합이 없으면 그 조건만 풀고 진행)
 * 6. 용병은 전력 계산 없이 인원이 적은 팀에 배정 (팀 간 용병 수 차이 1명 이내), 키퍼 순서 랜덤
 */
export function arrangeTeams(
  participants: ArrangeParticipant[],
  weights: Record<string, Record<string, number>>,
  options: ArrangeOptions,
  rand: () => number = Math.random
): ArrangedMember[] {
  const { mercCount, teamCount, recent = [], pastMatches = [], fixed = {} } = options;
  const players = participants.map(p => toPlayer(p, weights, rand));
  const history = [...recent, ...pastMatches].filter(rows => rows.length > 0).slice(0, HISTORY_WEIGHTS.length);
  const lastTeamOf = new Map(history[0]?.map(r => [r.member_uid, r.team_no ?? undefined]) ?? []);
  const aces = acesOf(players);

  // 2. 후보 생성
  const unique = new Map<string, Candidate>();
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const scatter = lastTeamOf.size > 0 && i % 2 === 1;
    const teams = scatter
      ? buildScatteredTeams(players, teamCount, fixed, lastTeamOf, rand)
      : buildTeams(players, teamCount, fixed, aces, rand);
    // 맞교환 전 조합도 후보로 남김: 맞교환은 흩어 놓은 선수를 다시 모을 수 있음
    const unbalanced = teams.map(t => [...t]);
    unique.set(teamsSignature(unbalanced), evaluate(unbalanced));
    balanceTeams(teams, aces, fixed, rand);
    unique.set(teamsSignature(teams), evaluate(teams));
  }
  const candidates = [...unique.values()];
  const keep = (list: Candidate[], test: (c: Candidate) => boolean) => {
    const kept = list.filter(test);
    return kept.length > 0 ? kept : list;
  };

  // 3. 포지션 구성, 최상위·최하위 분리
  const topBottom = topAndBottom(players);
  const positioned = keep(candidates, c => c.covered);
  const separated = topBottom && wereTogetherLastTime(topBottom, [...recent, ...pastMatches])
    ? keep(positioned, c => !c.teams.some(t => topBottom.every(uid => t.some(p => p.member_uid === uid))))
    : positioned;

  // 4. 그날 가능한 최선의 밸런스
  const bestGap = Math.min(...separated.map(c => c.gap));
  const balanced = separated.filter(c => c.gap <= bestGap + balanceSlack(teamCount));

  // 5. 가장 많이 흩어진 조합들 중 랜덤
  const scored = balanced
    .map(c => ({ c, score: reunionScore(c.teams, history, topBottom) }))
    .sort((a, b) => a.score - b.score);
  const minScore = scored[0].score;
  const withinSlack = scored.filter(s => s.score <= minScore + SCATTER_SLACK);
  const finalPool = withinSlack.length >= MIN_FINAL_POOL ? withinSlack : scored.slice(0, MIN_FINAL_POOL);
  const chosen = pickRandom(finalPool, rand).c;

  const teams: ArrangedMember[][] = chosen.teams.map((team, idx) => team.map(p => ({
    member_uid: p.member_uid,
    member_name: p.member_name,
    merc_yn: 'N' as const,
    team_no: idx + 1,
    keeper_order: 0,
    position: p.positions[0],
    fixed: fixed[p.member_uid] !== undefined,
  })));

  // 6. 용병: 인원이 적은 팀 우선, 동률이면 용병이 적은 팀, 그래도 같으면 랜덤
  const mercsIn = (team: ArrangedMember[]) => team.filter(m => m.merc_yn === 'Y').length;
  for (let i = 1; i <= mercCount; i++) {
    const minSize = Math.min(...teams.map(t => t.length));
    const smallest = teams.filter(t => t.length === minSize);
    const minMercs = Math.min(...smallest.map(mercsIn));
    const team = pickRandom(smallest.filter(t => mercsIn(t) === minMercs), rand);
    team.push({
      member_uid: `merc_${i}`,
      member_name: `용병${i}`,
      merc_yn: 'Y',
      team_no: teams.indexOf(team) + 1,
      keeper_order: 0,
    });
  }

  teams.forEach(team => {
    const order = shuffle(team.map((_, i) => i + 1), rand);
    team.forEach((m, i) => { m.keeper_order = order[i]; });
  });

  return teams.flat().sort((a, b) => a.team_no - b.team_no || a.keeper_order - b.keeper_order);
}

export interface OverflowInfo {
  excess: number;              // 정원을 넘은 인원
  suggestedTeamCount?: number; // 늘리면 정원에 맞는 팀 수
  overMax: boolean;            // 최대 팀 수로 늘려도 초과
  mercsToRemove?: number;      // 이만큼 용병을 줄이면 정원에 맞음
}

// 총인원 기준 정원 초과 안내. 초과가 없으면 null
export function getOverflowInfo(total: number, mercCount: number, teamCount: number, teamSize: number): OverflowInfo | null {
  const excess = total - teamCount * teamSize;
  if (excess <= 0) return null;

  const overMax = total > MAX_TEAM_COUNT * teamSize;
  let suggestedTeamCount: number | undefined;
  if (!overMax && excess >= teamCount) {
    for (let t = teamCount + 1; t <= MAX_TEAM_COUNT; t++) {
      if (total <= t * teamSize && Math.floor(total / t) >= MIN_TEAM_SIZE) {
        suggestedTeamCount = t;
        break;
      }
    }
  }
  return { excess, suggestedTeamCount, overMax, mercsToRemove: mercCount >= excess ? excess : undefined };
}
