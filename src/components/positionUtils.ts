export interface PositionDef {
  code: string;
  name: string;
  abbr: string;
  color: string;
  bgColor: string;
}

// 요청된 5개 포지션 및 정렬 순서: 픽소(FIX), 센트로(CEN), 아라(ALA), 피보(PIV), 골레이로(GOL)
// [FIX] : 파란색, [PIV] : 빨간색, [ALA] : 초록색, [GOL] : 노란색, [CEN] : 보라색
export const POSITIONS: PositionDef[] = [
  { code: 'FIX', name: '픽소', abbr: 'FIX', color: '#3182f6', bgColor: '#3182f6' },
  { code: 'CEN', name: '센트로', abbr: 'CEN', color: '#8b5cf6', bgColor: '#8b5cf6' },
  { code: 'ALA', name: '아라', abbr: 'ALA', color: '#2ecc71', bgColor: '#2ecc71' },
  { code: 'PIV', name: '피보', abbr: 'PIV', color: '#f04452', bgColor: '#f04452' },
  { code: 'GOL', name: '골레이로', abbr: 'GOL', color: '#f5a623', bgColor: '#f5a623' },
];

// 기본 가중치 정의 (28개 스탯, 가중치 총합 1.0)
export const DEFAULT_POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GOL: {
    '001': 0.008, '002': 0.008, '003': 0.023, '004': 0.008, '015': 0.115,
    '018': 0.008, '021': 0.008, '022': 0.008, '023': 0.057, '024': 0.057, '025': 0.057, '026': 0.008,
    '010': 0.008, '011': 0.008, '012': 0.115, '013': 0.008, '014': 0.023, '016': 0.023, '017': 0.008,
    '005': 0.008, '006': 0.023, '007': 0.115, '008': 0.057, '009': 0.115, '019': 0.008, '020': 0.002, '027': 0.057, '028': 0.057
  },
  FIX: {
    '001': 0.043, '002': 0.043, '003': 0.017, '004': 0.006, '015': 0.006,
    '018': 0.006, '021': 0.006, '022': 0.006, '023': 0.043, '024': 0.043, '025': 0.043, '026': 0.006,
    '010': 0.087, '011': 0.043, '012': 0.087, '013': 0.087, '014': 0.043, '016': 0.017, '017': 0.087,
    '005': 0.043, '006': 0.043, '007': 0.043, '008': 0.017, '009': 0.087, '019': 0.006, '020': 0.008, '027': 0.017, '028': 0.017
  },
  ALA: {
    '001': 0.006, '002': 0.092, '003': 0.092, '004': 0.092, '015': 0.006,
    '018': 0.092, '021': 0.046, '022': 0.046, '023': 0.046, '024': 0.006, '025': 0.046, '026': 0.092,
    '010': 0.018, '011': 0.018, '012': 0.006, '013': 0.006, '014': 0.018, '016': 0.006, '017': 0.018,
    '005': 0.006, '006': 0.004, '007': 0.046, '008': 0.046, '009': 0.018, '019': 0.046, '020': 0.046, '027': 0.018, '028': 0.018
  },
  PIV: {
    '001': 0.099, '002': 0.099, '003': 0.020, '004': 0.007, '015': 0.007,
    '018': 0.007, '021': 0.099, '022': 0.099, '023': 0.050, '024': 0.006, '025': 0.020, '026': 0.050,
    '010': 0.006, '011': 0.006, '012': 0.006, '013': 0.006, '014': 0.006, '016': 0.050, '017': 0.006,
    '005': 0.006, '006': 0.006, '007': 0.050, '008': 0.050, '009': 0.099, '019': 0.050, '020': 0.050, '027': 0.020, '028': 0.020
  },
  CEN: {
    '001': 0.006, '002': 0.049, '003': 0.049, '004': 0.006, '015': 0.006,
    '018': 0.006, '021': 0.006, '022': 0.006, '023': 0.098, '024': 0.049, '025': 0.098, '026': 0.020,
    '010': 0.020, '011': 0.049, '012': 0.020, '013': 0.006, '014': 0.020, '016': 0.007, '017': 0.006,
    '005': 0.006, '006': 0.006, '007': 0.049, '008': 0.020, '009': 0.098, '019': 0.098, '020': 0.049, '027': 0.098, '028': 0.049
  }
};

// 6각형 그래프용 6개 축 스탯 그룹핑
export const RADAR_CATEGORIES = [
  { key: 'physical', label: '피지컬', codes: ['001', '002', '003', '004', '015'] },
  { key: 'technique', label: '기술', codes: ['018', '026', '025', '023', '024'] },
  { key: 'attack', label: '공격', codes: ['021', '022', '019', '020'] },
  { key: 'defense', label: '수비', codes: ['010', '011', '012', '013', '014', '016', '017'] },
  { key: 'mental', label: '멘탈', codes: ['005', '006', '007', '008', '009'] },
  { key: 'sense', label: '센스', codes: ['027', '028'] },
];

export interface PositionScoreResult {
  code: string;
  name: string;
  abbr: string;
  color: string;
  bgColor: string;
  score: number;
  scoreStr: string;
  isHighest: boolean;
}

/**
 * 선수의 28개 스탯과 가중치를 기반으로 포지션별 능력치 계산
 * 점수 계산식: sum(score_val * weight) * 5 (0~20점 * 5 = 0~100점 환산)
 * 정렬 순서: 픽소(FIX), 센트로(CEN), 아라(ALA), 피보(PIV), 골레이로(GOL)
 * 최고점 포지션에 isHighest = true 부여
 */
export function calculatePositionScores(
  scores: Array<{ score_cd: string; score_val: string | number }>,
  customWeights?: Record<string, Record<string, number>>
): PositionScoreResult[] {
  const scoreMap: Record<string, number> = {};
  scores.forEach(s => {
    scoreMap[s.score_cd] = typeof s.score_val === 'string' ? parseFloat(s.score_val) || 13 : s.score_val;
  });

  const weightsSource = customWeights && Object.keys(customWeights).length > 0 ? customWeights : DEFAULT_POSITION_WEIGHTS;

  const results = POSITIONS.map(pos => {
    const posWeights = weightsSource[pos.code] || DEFAULT_POSITION_WEIGHTS[pos.code] || {};
    let weightedSum = 0;
    Object.entries(posWeights).forEach(([scoreCd, weight]) => {
      const val = scoreMap[scoreCd] ?? 13;
      weightedSum += val * weight;
    });

    // 0~20점 스케일 * 5 = 100점 만점
    const finalScore = weightedSum * 5;
    return {
      code: pos.code,
      name: pos.name,
      abbr: pos.abbr,
      color: pos.color,
      bgColor: pos.bgColor,
      score: finalScore,
      scoreStr: finalScore.toFixed(2),
      isHighest: false
    };
  });

  // 최고 점수 찾기
  let maxScore = -1;
  results.forEach(r => {
    if (r.score > maxScore) {
      maxScore = r.score;
    }
  });

  results.forEach(r => {
    if (r.score === maxScore && maxScore > 0) {
      r.isHighest = true;
    }
  });

  return results;
}

/**
 * 6개 축 레이더 차트 수치 계산 (각 축당 0~20점)
 */
export function calculateRadarScores(
  scores: Array<{ score_cd: string; score_val: string | number }>
): { [key: string]: number } {
  const scoreMap: Record<string, number> = {};
  scores.forEach(s => {
    scoreMap[s.score_cd] = typeof s.score_val === 'string' ? parseFloat(s.score_val) || 13 : s.score_val;
  });

  const hasScores = Object.keys(scoreMap).length > 0;
  const radarValues: Record<string, number> = {};
  RADAR_CATEGORIES.forEach(cat => {
    // 점수 데이터가 있으면 삭제된 항목(점수 없음)은 평균에서 제외
    const codes = hasScores ? cat.codes.filter(c => c in scoreMap) : cat.codes;
    let sum = 0;
    codes.forEach(c => {
      sum += scoreMap[c] ?? 13;
    });
    radarValues[cat.key] = codes.length > 0 ? parseFloat((sum / codes.length).toFixed(1)) : 13;
  });

  return radarValues;
}

/**
 * /position_point/search 결과를 포지션별 가중치 맵으로 변환
 * DB에 저장된 항목만 사용 (삭제된 항목이 기본값으로 되살아나지 않도록 기본값과 병합하지 않음)
 */
export function buildWeightsFromRows(
  rows: Array<{ position_cd: string; score_cd: string; position_val: string | number | null }> | null | undefined
): Record<string, Record<string, number>> {
  if (!rows || rows.length === 0) return JSON.parse(JSON.stringify(DEFAULT_POSITION_WEIGHTS));
  const loaded: Record<string, Record<string, number>> = {};
  for (const item of rows) {
    if (!loaded[item.position_cd]) loaded[item.position_cd] = {};
    loaded[item.position_cd][item.score_cd] = parseFloat(String(item.position_val)) || 0;
  }
  return loaded;
}

// In-memory cache for position weights across tabs
let memoryPositionWeights: Record<string, Record<string, number>> | null = null;

export function getCachedPositionWeights(): Record<string, Record<string, number>> | null {
  return memoryPositionWeights;
}

export function setCachedPositionWeights(weights: Record<string, Record<string, number>>) {
  memoryPositionWeights = weights;
}

