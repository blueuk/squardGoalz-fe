import { calculatePositionScores, calculateRadarScores } from './positionUtils';

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

// 지난 경기 배정 이력의 한 행
export interface PastArrangeRow {
  vote_seq: number;
  member_uid: string;
  team_no?: number | null;
  play_date?: string | null;
}

export interface ArrangeOptions {
  mercCount: number; // 용병 수 (기본 0)
  teamCount: number; // 팀 수 (2~4)
  teamSize: number;  // 팀당 정원 (4~6)
  previous?: ArrangedMember[]; // 다시 섞기 전 결과: 거의 같은 조합은 제외
  pastMatches?: PastArrangeRow[][]; // 지난 경기 배정 (최근 경기부터): 최상위·최하위 연속 같은 팀 방지
  fixed?: FixedTeams; // 미리 지정한 선수는 그 팀에 고정하고 나머지만 배정
}

export const MAX_TEAM_COUNT = 4;
export const MIN_TEAM_SIZE = 4;
export const MAX_TEAM_SIZE = 6;

const CANDIDATE_COUNT = 300;  // 만들어 볼 후보 조합 수
const ACE_RATIO = 1 / 3;      // 상위 이 비율을 에이스로 보고 먼저 고르게 나눔
const MAX_SWAP_STEPS = 10;    // 후보당 선수 맞교환 최대 횟수
const MAX_POWER_GAP = 1.5; // 허용하는 팀 평균 전력 차 (100점 기준)
const MIN_POOL_SIZE = 10;     // 조건을 만족한 조합이 이보다 적으면 가장 가까운 조합으로 채움
const FINAL_POOL_RATIO = 0.5; // 세부 능력이 고른 상위 이 비율 안에서 랜덤 선택 (1등만 고르면 결과가 굳어짐)
const MAX_PREVIOUS_OVERLAP = 0.8; // 직전 결과와 같은 팀 쌍 비율이 이 이상이면 제외

// 골레이로는 팀원이 돌아가며 맡으므로 전력·포지션 조건에서 제외
const DEFENSE_POSITIONS = ['FIX'];
const ATTACK_POSITIONS = ['ALA', 'PIV'];
const TOP_POSITION_COUNT = 2; // 포지션 조건에는 2순위까지 인정

interface Player {
  member_uid: string;
  member_name: string;
  power: number;
  positions: string[]; // 필드 포지션 점수 내림차순 상위
  radar: Record<string, number>;
}

interface Candidate {
  teams: Player[][];
  gap: number;
  covered: boolean;
  radarSpread: number;
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
    radar: calculateRadarScores(p.scores),
  };
};

const teamAverage = (team: Player[]) => average(team.map(p => p.power));

const powerGap = (teams: Player[][]) => {
  const powers = teams.filter(t => t.length > 0).map(teamAverage);
  return powers.length > 0 ? Math.max(...powers) - Math.min(...powers) : 0;
};

// 전력이 가장 높은 팀과 낮은 팀의 같은 그룹(에이스/나머지) 선수를 맞바꿔 허용 범위까지 전력 차를 줄임
// (교환은 개선되는 것 중 랜덤: 최선만 고르면 전력 차가 큰 참석자 구성에서 모든 후보가 한 조합으로 수렴함)
// 미리 지정한 선수는 교환하지 않음
const balanceTeams = (teams: Player[][], aces: Set<string>, fixed: FixedTeams, rand: () => number) => {
  for (let step = 0; step < MAX_SWAP_STEPS; step++) {
    const gap = powerGap(teams);
    if (gap <= MAX_POWER_GAP) return;
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

    const passing = improving.filter(s => s.gap <= MAX_POWER_GAP);
    const swap = pickRandom(passing.length > 0 ? passing : improving, rand);
    [high[swap.a], low[swap.b]] = [low[swap.b], high[swap.a]];
  }
};

// 미리 지정한 선수를 먼저 넣고, 에이스는 에이스가 적은 팀부터, 나머지는 인원이 적은 팀부터 랜덤으로 나눔
// (지정 선수가 한 팀에 몰린 경우가 아니면 팀 인원 차이는 1명 이내)
const buildTeams = (players: Player[], teamCount: number, fixed: FixedTeams, rand: () => number) => {
  const ranked = shuffle(players, rand).sort((a, b) => b.power - a.power);
  const aceCount = Math.floor(ranked.length * ACE_RATIO);
  const aces = new Set(ranked.slice(0, aceCount).map(p => p.member_uid));
  const teams: Player[][] = Array.from({ length: teamCount }, () => []);
  const free = ranked.filter(p => {
    const team = teams[fixed[p.member_uid] - 1];
    if (team) team.push(p);
    return !team;
  });

  const acesIn = (team: Player[]) => team.filter(p => aces.has(p.member_uid)).length;
  const smallest = (list: Player[][]) => {
    const minSize = Math.min(...list.map(t => t.length));
    return list.filter(t => t.length === minSize);
  };
  for (const player of shuffle(free.filter(p => aces.has(p.member_uid)), rand)) {
    const minAces = Math.min(...teams.map(acesIn));
    pickRandom(smallest(teams.filter(t => acesIn(t) === minAces)), rand).push(player);
  }
  for (const player of shuffle(free.filter(p => !aces.has(p.member_uid)), rand)) {
    pickRandom(smallest(teams), rand).push(player);
  }
  return { teams, aces };
};

// 팀 수·정원이 바뀌면 그 안에 들어가지 않는 미리 지정을 해제
export function trimFixedTeams(fixed: FixedTeams, teamCount: number, teamSize: number): FixedTeams {
  const counts: Record<number, number> = {};
  return Object.fromEntries(Object.entries(fixed).filter(([, teamNo]) => {
    counts[teamNo] = (counts[teamNo] ?? 0) + 1;
    return teamNo <= teamCount && counts[teamNo] <= teamSize;
  }));
}

// 팀 순서·팀 내 순서와 무관한 조합 식별값 (같은 조합 중복 제거용)
const teamsSignature = (teams: Player[][]) =>
  teams.map(t => t.map(p => p.member_uid).sort().join(',')).sort().join('|');

const evaluate = (teams: Player[][]): Candidate => {
  const filled = teams.filter(t => t.length > 0);
  const hasPosition = (team: Player[], codes: string[]) => team.some(p => p.positions.some(c => codes.includes(c)));
  const radarKeys = Object.keys(filled[0]?.[0]?.radar ?? {});
  const radarSpread = radarKeys.reduce((sum, key) => {
    const values = filled.map(t => average(t.map(p => p.radar[key])));
    return sum + Math.max(...values) - Math.min(...values);
  }, 0);
  return {
    teams,
    gap: powerGap(teams),
    covered: teams.every(t => hasPosition(t, DEFENSE_POSITIONS) && hasPosition(t, ATTACK_POSITIONS)),
    radarSpread,
  };
};

// 후보의 같은 팀 쌍 중 직전 결과에서도 같은 팀이었던 비율
const overlapWithPrevious = (teams: Player[][], previous: ArrangedMember[]) => {
  const prevTeam = new Map(previous.map(m => [m.member_uid, m.team_no]));
  let pairs = 0;
  let same = 0;
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        pairs++;
        const a = prevTeam.get(team[i].member_uid);
        if (a !== undefined && a === prevTeam.get(team[j].member_uid)) same++;
      }
    }
  }
  return pairs > 0 ? same / pairs : 0;
};

// 평균을 맞추다 보면 최하위 선수의 팀에 최상위 선수가 반복해서 묶임.
// 두 선수가 함께 뛴 가장 최근 경기에서 같은 팀이었으면 이번에는 분리할 쌍으로 반환
const pairToSeparate = (players: Player[], pastMatches: PastArrangeRow[][] = []): [string, string] | null => {
  if (players.length < 2) return null;
  const ranked = [...players].sort((a, b) => b.power - a.power);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  if (top.power === bottom.power) return null;

  for (const match of pastMatches) {
    const topRow = match.find(r => r.member_uid === top.member_uid);
    const bottomRow = match.find(r => r.member_uid === bottom.member_uid);
    if (topRow && bottomRow) {
      return topRow.team_no === bottomRow.team_no ? [top.member_uid, bottom.member_uid] : null;
    }
  }
  return null;
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

/**
 * 팀 배정: 전력 균형은 필수 조건, 다양성은 그 안에서 선택
 * 0. 미리 지정한 선수(fixed)는 그 팀에 고정하고 나머지 선수만 아래 과정으로 배정
 * 1. 에이스를 먼저 고르게 나누고 같은 그룹끼리 맞바꿔 전력 차를 줄인 후보 조합을 여러 개 생성 (중복 제거)
 * 2. 다시 섞기면 직전 결과와 거의 같은 조합을 제외
 * 3. 팀 평균 전력 차가 허용 범위 안이고 팀마다 수비·공격 포지션이 있는 조합만 남김
 *    (최상위·최하위 선수가 지난번 같은 팀이었으면 이번에는 분리)
 *    (조건을 만족하는 조합이 부족하면 가장 가까운 조합으로 채움)
 * 4. 세부 능력(레이더 항목)이 고른 상위 조합 중 랜덤 선택
 * 5. 용병은 전력 계산 없이 인원이 적은 팀에 배정 (팀 간 용병 수 차이 1명 이내)
 * 6. 팀별 키퍼 순서를 1..팀인원으로 랜덤 부여
 */
export function arrangeTeams(
  participants: ArrangeParticipant[],
  weights: Record<string, Record<string, number>>,
  options: ArrangeOptions,
  rand: () => number = Math.random
): ArrangedMember[] {
  const { mercCount, teamCount, previous, pastMatches, fixed = {} } = options;
  const players = participants.map(p => toPlayer(p, weights, rand));

  const unique = new Map<string, Candidate>();
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const { teams, aces } = buildTeams(players, teamCount, fixed, rand);
    // 맞교환 전 조합도 후보로 남김: 전력 차를 못 줄이는 참석자 구성에서도 다시 섞기 결과가 달라지도록
    const unbalanced = teams.map(t => [...t]);
    unique.set(teamsSignature(unbalanced), evaluate(unbalanced));
    balanceTeams(teams, aces, fixed, rand);
    unique.set(teamsSignature(teams), evaluate(teams));
  }
  const candidates = [...unique.values()];

  // 맞는 조합이 없으면 전력 차 > 최상위·최하위 분리 > 포지션 구성 > 직전 결과와 다름 순으로 조건을 완화
  const different = previous && previous.length > 0
    ? candidates.filter(c => overlapWithPrevious(c.teams, previous) < MAX_PREVIOUS_OVERLAP)
    : candidates;
  const usable = different.length > 0 ? different : candidates;
  const covered = usable.filter(c => c.covered);
  const positioned = covered.length > 0 ? covered : usable;
  const pair = pairToSeparate(players, pastMatches);
  const separated = pair
    ? positioned.filter(c => !c.teams.some(t => pair.every(uid => t.some(p => p.member_uid === uid))))
    : positioned;
  const eligible = separated.length > 0 ? separated : positioned;

  const passed = eligible.filter(c => c.gap <= MAX_POWER_GAP);
  const pool = passed.length >= MIN_POOL_SIZE
    ? passed
    : [...eligible].sort((a, b) => a.gap - b.gap).slice(0, MIN_POOL_SIZE);
  const finalCount = Math.max(MIN_POOL_SIZE, Math.ceil(pool.length * FINAL_POOL_RATIO));
  const chosen = pickRandom([...pool].sort((a, b) => a.radarSpread - b.radarSpread).slice(0, finalCount), rand);

  const teams: ArrangedMember[][] = chosen.teams.map((team, idx) => team.map(p => ({
    member_uid: p.member_uid,
    member_name: p.member_name,
    merc_yn: 'N' as const,
    team_no: idx + 1,
    keeper_order: 0,
    position: p.positions[0],
    fixed: fixed[p.member_uid] !== undefined,
  })));

  // 용병: 인원이 적은 팀 우선, 동률이면 용병이 적은 팀, 그래도 같으면 랜덤
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
