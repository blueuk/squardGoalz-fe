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
  position?: string;    // 포지션 단계에서 뽑힌 경우 해당 포지션
}

export interface ArrangeOptions {
  mercCount: number; // 용병 수 (기본 0)
  teamCount: number; // 팀 수 (2~4)
  teamSize: number;  // 팀당 정원 (4~6)
}

// 팀 수 대비 포지션별 상한: 픽소·아라 팀수 x 2, 센트로·피보·골레이로 팀수 x 1
export const POSITION_QUOTA_PER_TEAM: Record<string, number> = { FIX: 2, ALA: 2, CEN: 1, PIV: 1, GOL: 1 };

export const MAX_TEAM_COUNT = 4;
export const MIN_TEAM_SIZE = 4;
export const MAX_TEAM_SIZE = 6;

const shuffle = <T,>(arr: T[], rand: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * 팀 배정
 * 1. 참가자별 최고 포지션 산출 (동점이면 랜덤)
 * 2. 참가자들의 최고 포지션 목록으로 뽑을 순서를 랜덤 결정
 * 3. 순서대로 해당 포지션이 최고인 미배정 참가자를 포지션 점수 내림차순으로 상한만큼 추출,
 *    인원이 적은 팀 중 랜덤으로 한 명씩 배정 (팀당 포지션 상한, 팀 정원 초과 금지)
 * 4. 남은 참가자 + 용병을 랜덤 순서로 인원이 가장 적은 팀부터 배정 (정원 초과 시에도 배정)
 * 5. 팀별 키퍼 순서를 1..팀인원으로 랜덤 부여
 */
export function arrangeTeams(
  participants: ArrangeParticipant[],
  weights: Record<string, Record<string, number>>,
  options: ArrangeOptions,
  rand: () => number = Math.random
): ArrangedMember[] {
  const { mercCount, teamCount, teamSize } = options;
  const teams: ArrangedMember[][] = Array.from({ length: teamCount }, () => []);
  const teamPosCount: Record<string, number>[] = Array.from({ length: teamCount }, () => ({}));

  // 1. 최고 포지션 산출
  const candidates = participants.map(p => {
    const results = calculatePositionScores(p.scores, weights);
    const posScore: Record<string, number> = {};
    results.forEach(r => { posScore[r.code] = r.score; });
    const tops = results.filter(r => r.isHighest);
    const best = tops.length > 0 ? tops[Math.floor(rand() * tops.length)].code : results[0]?.code;
    return { ...p, best, posScore };
  });

  const assigned = new Set<string>();
  const assign = (teamIdx: number, m: { member_uid: string; member_name: string }, merc: boolean, position?: string) => {
    teams[teamIdx].push({ member_uid: m.member_uid, member_name: m.member_name, merc_yn: merc ? 'Y' : 'N', team_no: teamIdx + 1, keeper_order: 0, position });
    if (position) teamPosCount[teamIdx][position] = (teamPosCount[teamIdx][position] || 0) + 1;
    assigned.add(m.member_uid);
  };

  // 2. 포지션 뽑을 순서 랜덤
  const positionOrder = shuffle([...new Set(candidates.map(c => c.best).filter(Boolean))] as string[], rand);

  // 3. 포지션별 추출 및 배정
  for (const pos of positionOrder) {
    const perTeam = POSITION_QUOTA_PER_TEAM[pos] ?? 1;
    const picked = candidates
      .filter(c => c.best === pos && !assigned.has(c.member_uid))
      .sort((a, b) => (b.posScore[pos] ?? 0) - (a.posScore[pos] ?? 0))
      .slice(0, perTeam * teamCount);

    for (const c of picked) {
      // 받을 수 있는 팀(정원·포지션 상한 미만) 중 인원이 가장 적은 팀들 사이에서 랜덤
      const open = teams.map((_, idx) => idx)
        .filter(idx => teams[idx].length < teamSize && (teamPosCount[idx][pos] || 0) < perTeam);
      if (open.length === 0) break; // 받을 수 있는 팀이 없으면 남은 인원은 4단계로
      const minSize = Math.min(...open.map(idx => teams[idx].length));
      const smallest = open.filter(idx => teams[idx].length === minSize);
      assign(smallest[Math.floor(rand() * smallest.length)], c, false, pos);
    }
  }

  // 4. 남은 인원 + 용병 랜덤 배정 (인원이 적은 팀 우선, 동률은 랜덤)
  const leftovers = [
    ...candidates.filter(c => !assigned.has(c.member_uid)).map(c => ({ member_uid: c.member_uid, member_name: c.member_name, merc: false })),
    ...Array.from({ length: mercCount }, (_, i) => ({ member_uid: `merc_${i + 1}`, member_name: `용병${i + 1}`, merc: true })),
  ];
  for (const m of shuffle(leftovers, rand)) {
    const minSize = Math.min(...teams.map(t => t.length));
    const smallest = teams.map((t, idx) => (t.length === minSize ? idx : -1)).filter(idx => idx >= 0);
    assign(smallest[Math.floor(rand() * smallest.length)], m, m.merc);
  }

  // 5. 키퍼 순서
  teams.forEach(team => {
    const order = shuffle(team.map((_, i) => i + 1), rand);
    team.forEach((m, i) => { m.keeper_order = order[i]; });
  });

  return teams.flat().sort((a, b) => a.team_no - b.team_no || a.keeper_order - b.keeper_order);
}
