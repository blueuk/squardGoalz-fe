// 풋살 포지션 유형 테스트 (풋살 MBTI) 문항·유형·판정
// 원본: github.com/blueuk/greenpeppers mbti.html v0.3 의 문항·유형을 옮기고 판정 버그를 고침
//  - 50% 동점이면 항상 앞 글자(전방·측면·파워·해결)로 쏠리던 문제 → 응답 경향으로 판정, 그래도 같으면 무작위
//  - 답을 빠르게 두 번 누르면 문항이 건너뛰어지던 문제 → 테스트 화면에서 전환 중 입력을 막음 (FutsalMbtiTest)

export const QUESTION_VER = 'v0.3';

export type TestType = 'field' | 'gk';
export type AxisKey = 'FB' | 'CW' | 'PT' | 'SL';

// a: 성향 %가 높을 때 글자, b: 낮을 때 글자
export const AXES: Record<AxisKey, { a: string; b: string; an: string; bn: string; tag: string }> = {
  FB: { a: 'F', b: 'B', an: '전방', bn: '후방', tag: '공격 vs 수비' },
  CW: { a: 'W', b: 'C', an: '측면', bn: '중앙', tag: '중앙 vs 측면' },
  PT: { a: 'P', b: 'T', an: '파워', bn: '테크닉', tag: '파워 vs 테크닉' },
  SL: { a: 'S', b: 'L', an: '해결', bn: '연결', tag: '해결 vs 연결' },
};

export const AXIS_ORDER: Record<TestType, AxisKey[]> = { field: ['FB', 'CW', 'PT', 'SL'], gk: ['PT', 'SL'] };

export interface Question {
  ax: AxisKey;
  t: string;
  r?: boolean; // 역문항: 그렇다고 할수록 b 성향
}

export const FIELD_QUESTIONS: Question[] = [
  { ax: 'FB', t: '경기 중 상대 골문 근처에 머무는 시간이 길다' },
  { ax: 'FB', t: '공을 뺏으면 수비 위치를 지키기보다 먼저 앞으로 뛰어나간다' },
  { ax: 'FB', t: '한 경기에 슈팅을 여러 번 시도한다' },
  { ax: 'FB', t: '팀이 공격할 때 내가 맨 뒤에 남아 있다', r: true },
  { ax: 'FB', t: '팀이 공격할 때 상대 박스 안까지 들어간다' },
  { ax: 'FB', t: '팀이 지고 있으면 내가 더 올라가서 공격한다' },
  { ax: 'FB', t: '상대 역습 때 가장 먼저 수비 위치로 돌아온다', r: true },
  { ax: 'FB', t: '경기 중 내 위치는 대체로 하프라인보다 앞이다' },
  { ax: 'CW', t: '공을 받을 때 터치라인 근처에 서 있다' },
  { ax: 'CW', t: '측면에서 수비수와 1:1 드리블을 시도한다' },
  { ax: 'CW', t: '중앙에서 상대를 등지고 공을 받는다', r: true },
  { ax: 'CW', t: '사이드로 넓게 벌려 공간을 만든다' },
  { ax: 'CW', t: '공을 잡으면 측면을 따라 전진한다' },
  { ax: 'CW', t: '사이드에서 크로스나 컷백을 시도한다' },
  { ax: 'CW', t: '경기장 중앙에서 공을 받아 반대편으로 방향을 바꿔 준다', r: true },
  { ax: 'CW', t: '왼쪽이나 오른쪽 한 측면 라인을 맡아 주로 그쪽에서 뛴다' },
  { ax: 'PT', t: '어깨싸움이 붙으면 피하지 않고 맞부딪친다' },
  { ax: 'PT', t: '상대를 제칠 때 공을 길게 치고 달려서 넘어간다' },
  { ax: 'PT', t: '공을 받을 때 몸으로 상대를 먼저 막아 놓고 받는다' },
  { ax: 'PT', t: '경기 후반까지 압박과 스프린트를 계속한다' },
  { ax: 'PT', t: '슈팅할 때 코스보다 힘을 실어 강하게 찬다' },
  { ax: 'PT', t: '1:1에서 페인트나 발바닥 컨트롤로 상대를 제친다', r: true },
  { ax: 'PT', t: '좁은 공간에서 짧은 터치로 공을 빼낸다', r: true },
  { ax: 'PT', t: '토킥, 칩슛, 힐패스 같은 기술을 경기에서 쓴다', r: true },
  { ax: 'SL', t: '슈팅 각이 나오면 옆 동료가 비어 있어도 직접 슈팅한다' },
  { ax: 'SL', t: '수비 때 직접 공을 끊으러 나간다' },
  { ax: 'SL', t: '공격이 막히면 혼자 드리블로 돌파를 시도한다' },
  { ax: 'SL', t: '골보다 어시스트를 더 많이 기록한다', r: true },
  { ax: 'SL', t: '앞에 공간이 보이면 패스 대신 직접 치고 나간다' },
  { ax: 'SL', t: '공을 받으면 1~2터치 안에 동료에게 연결한다', r: true },
  { ax: 'SL', t: '동료가 움직일 공간을 만들려고 수비수를 끌고 다닌다', r: true },
  { ax: 'SL', t: '승부처에서 공을 달라고 먼저 외친다' },
];

export const GK_QUESTIONS: Question[] = [
  { ax: 'PT', t: '슈팅을 잡아내기보다 쳐내거나 몸으로 막아낸다' },
  { ax: 'PT', t: '가까운 거리 슈팅에 다이빙하거나 몸을 던진다' },
  { ax: 'PT', t: '공을 잡으면 발보다 손으로 던져서 배급한다' },
  { ax: 'PT', t: '백패스를 받으면 패스로 연결하기보다 바로 걷어낸다' },
  { ax: 'PT', t: '경기 중 넘어지거나 몸을 날리는 장면이 나온다' },
  { ax: 'PT', t: '골킥이나 배급을 발로 짧게 연결한다', r: true },
  { ax: 'PT', t: '빌드업을 위해 박스 밖으로 나와 동료와 패스를 주고받는다', r: true },
  { ax: 'PT', t: '상대가 압박해 와도 발로 제치거나 패스로 풀어낸다', r: true },
  { ax: 'SL', t: '상대가 뒷공간으로 침투하면 박스 밖까지 나가서 끊는다' },
  { ax: 'SL', t: '1:1 상황에서 기다리지 않고 먼저 달려나가 각을 좁힌다' },
  { ax: 'SL', t: '스루패스가 오면 수비수보다 먼저 공으로 달려간다' },
  { ax: 'SL', t: '공을 잡자마자 바로 역습 패스나 던지기를 한다' },
  { ax: 'SL', t: '경기 중 수비수에게 마크나 위치를 말로 지시한다', r: true },
  { ax: 'SL', t: '세트피스 때 벽 위치나 마크를 내가 정해 준다', r: true },
  { ax: 'SL', t: '공을 잡으면 동료들이 자리 잡을 때까지 기다렸다가 배급한다', r: true },
  { ax: 'SL', t: '상대가 공격해 오면 나가기보다 골문 앞에서 자리를 지킨다', r: true },
];

export const QUESTIONS: Record<TestType, Question[]> = { field: FIELD_QUESTIONS, gk: GK_QUESTIONS };

export const SCALE_FREQ = ['거의 없다', '가끔 있다', '반반이다', '자주 있다', '거의 항상'];

export interface MbtiType {
  pos: string;
  name: string;
  desc: string;
  str: string[];
  match: string[];
}

export const TYPES: Record<string, MbtiType> = {
  // 피보
  FCPL: { pos: '피보', name: '타겟형 피보', desc: '상대 골문 앞에서 등지고 버티며 공을 지켜내고, 올라오는 동료에게 연결해 주는 팀의 기준점이에요. 롱패스의 도착지이자 공격의 시작점입니다.', str: ['포스트 플레이', '볼 키핑', '등지고 연계'], match: ['FWTS', 'BCTL'] },
  FCPS: { pos: '피보', name: '파워 피니셔 피보', desc: '몸싸움으로 자리를 잡고 한 번의 터치로 마무리하는 득점 기계. 박스 안에서 가장 무서운 선수예요.', str: ['몸싸움 후 슈팅', '세컨볼 집중', '강한 슈팅'], match: ['FWTL', 'BCTL'] },
  FCTL: { pos: '피보', name: '원투 연계형 피보', desc: '짧은 원투 패스와 리턴으로 수비를 무너뜨리는 연결고리. 동료를 빛나게 해 주는 전방의 플레이메이커예요.', str: ['원투 패스', '공간 인식', '퍼스트 터치'], match: ['FWPS', 'FWTS'] },
  FCTS: { pos: '피보', name: '기술형 골게터 피보', desc: '좁은 공간에서도 턴 한 번으로 슈팅 각을 만드는 해결사. 개인 기술로 골을 만들어 냅니다.', str: ['턴 동작', '좁은 공간 드리블', '정교한 마무리'], match: ['FWTL', 'BCTL'] },
  // 아라
  FWPS: { pos: '아라', name: '공격적 침투형 아라', desc: '스피드로 측면 뒷공간을 파고들어 직접 슈팅까지 가져가는 돌격대장. 역습 상황에서 가장 위협적이에요.', str: ['뒷공간 침투', '스프린트', '반대편 포스트 마무리'], match: ['FCTL', 'BCTL'] },
  FWPL: { pos: '아라', name: '스피드 왕복형 아라', desc: '지치지 않는 체력으로 측면을 오르내리며 공격과 수비를 모두 지원해요. 팀의 엔진 같은 존재입니다.', str: ['활동량', '공수 전환', '측면 크로스'], match: ['FCPS', 'BCPS'] },
  FWTS: { pos: '아라', name: '측면 돌파형 아라', desc: '1:1 드리블로 측면을 찢고 직접 슈팅이나 컷백을 만들어 내는 크랙. 막힌 경기를 풀어주는 카드예요.', str: ['1:1 돌파', '개인기', '안쪽 파고들기'], match: ['FCPL', 'BCPS'] },
  FWTL: { pos: '아라', name: '찬스메이커 아라', desc: '측면에서 시야와 패스로 결정적인 찬스를 만드는 선수. 피보와의 호흡이 맞으면 어시스트가 쏟아져요.', str: ['킬패스', '시야', '템포 조절'], match: ['FCPS', 'FCTS'] },
  // 픽소
  BCPS: { pos: '픽소', name: '스토퍼형 픽소', desc: '몸싸움과 태클로 상대 공격을 정면에서 끊어내는 최후의 벽. 상대 피보가 가장 싫어하는 타입이에요.', str: ['대인 수비', '태클', '몸싸움'], match: ['FWTS', 'FCTL'] },
  BCPL: { pos: '픽소', name: '수비 리더형 픽소', desc: '뒤에서 전체를 보며 라인과 마크를 조율하는 리더. 단단한 피지컬에 안정감을 더한 팀의 중심축이에요.', str: ['수비 조율', '커버링', '콜 플레이'], match: ['FWTS', 'FCTS'] },
  BCTS: { pos: '픽소', name: '중거리 슈터 픽소', desc: '후방에서 공을 잡으면 과감한 중거리 슈팅으로 직접 골을 노려요. 수비수인데 득점력도 있는 무기형 선수.', str: ['중거리 슈팅', '볼 탈취 후 전진', '과감함'], match: ['FCPL', 'FWPL'] },
  BCTL: { pos: '픽소', name: '빌드업형 픽소', desc: '후방에서 패스로 공격을 설계하는 플레이메이커. 압박을 벗겨내고 전방으로 공을 정확히 배달해요.', str: ['빌드업', '롱패스', '탈압박'], match: ['FCPL', 'FWPS'] },
  // 센트로
  BWPS: { pos: '센트로', name: '압박형 센트로', desc: '넓은 범위를 뛰어다니며 공을 빼앗아 내는 압박 전문가. 상대가 편하게 공을 돌리지 못하게 만들어요.', str: ['전방 압박', '볼 탈취', '활동량'], match: ['BCTL', 'FCTS'] },
  BWPL: { pos: '센트로', name: '커버형 센트로', desc: '빈 공간을 채우고 동료의 뒤를 받쳐 주는 살림꾼. 눈에 덜 띄지만 없으면 팀이 무너지는 타입이에요.', str: ['커버 플레이', '위치 선정', '헌신'], match: ['FWTS', 'FCTS'] },
  BWTS: { pos: '센트로', name: '역습형 센트로', desc: '공을 끊자마자 드리블로 치고 나가 역습을 직접 이끄는 선수. 수비에서 공격으로의 전환이 가장 빨라요.', str: ['역습 전개', '전진 드리블', '전환 속도'], match: ['FCPL', 'BCPL'] },
  BWTL: { pos: '센트로', name: '밸런스형 센트로', desc: '어느 자리에 넣어도 제 몫을 하는 만능형. 패스와 위치 선정으로 팀의 균형을 잡아 줘요.', str: ['멀티 포지션', '패스 안정성', '경기 이해도'], match: ['FCPS', 'FWPS'] },
  // 골레이
  'G-PS': { pos: '골레이', name: '선방형 골레이', desc: '반사신경과 몸을 날리는 세이브로 골문을 지키는 수호신. 결정적인 순간 한 번의 선방으로 경기를 바꿔요.', str: ['반사신경', '근거리 선방', '담력'], match: ['BCPL', 'BWPL'] },
  'G-PL': { pos: '골레이', name: '지휘형 골레이', desc: '가장 뒤에서 경기 전체를 보며 목소리로 수비를 조율하는 리더. 골레이가 아니라 감독 같은 존재예요.', str: ['수비 지시', '위치 선정', '안정감'], match: ['BCPS', 'BWPS'] },
  'G-TS': { pos: '골레이', name: '스위퍼형 골레이', desc: '과감하게 튀어나와 1:1과 침투를 미리 끊어내는 공격적인 골레이. 뒷공간 걱정을 덜어 줍니다.', str: ['1:1 대응', '과감한 판단', '뒷공간 커버'], match: ['BCTL', 'BWTL'] },
  'G-TL': { pos: '골레이', name: '빌드업형 골레이', desc: '발밑이 좋아 공격 전개의 출발점이 되는 골레이. 플라잉 골레이로 수적 우위를 만들 수도 있어요.', str: ['발밑 기술', '빠른 배급', '플라잉 골레이'], match: ['BCTL', 'FCPL'] },
};

// 같은 축 문항이 연달아 나오지 않도록 축별로 번갈아 배치 (원래 문항 번호 유지)
export function interleave(questions: Question[]): { q: Question; no: number }[] {
  const groups: Record<string, { q: Question; no: number }[]> = {};
  questions.forEach((q, no) => { (groups[q.ax] = groups[q.ax] || []).push({ q, no }); });
  const keys = Object.keys(groups);
  const length = Math.max(...keys.map(k => groups[k].length));
  const out: { q: Question; no: number }[] = [];
  for (let i = 0; i < length; i++) keys.forEach(k => { if (groups[k][i]) out.push(groups[k][i]); });
  return out;
}

export interface MbtiResult {
  testType: TestType;
  code: string;
  pct: Partial<Record<AxisKey, number>>; // 0~100, 높을수록 a 성향
  answers: string; // 원래 문항 번호 순 응답 (1~5)
}

// answers: 원래 문항 번호 순 응답 (1~5)
export function scoreTest(testType: TestType, answers: number[], rand: () => number = Math.random): MbtiResult {
  const questions = QUESTIONS[testType];
  const pct: Partial<Record<AxisKey, number>> = {};
  const letters = AXIS_ORDER[testType].map(axis => {
    const values = questions.flatMap((q, i) => (q.ax === axis ? [q.r ? 6 - answers[i] : answers[i]] : []));
    const sum = values.reduce((s, v) => s + v, 0);
    const percent = Math.round(((sum - values.length) / (4 * values.length)) * 100);
    pct[axis] = percent;
    if (percent !== 50) return percent > 50 ? AXES[axis].a : AXES[axis].b;
    // 정확히 반반: 한쪽으로 기운 응답 수가 많은 쪽, 그래도 같으면 무작위
    const leanA = values.filter(v => v > 3).length;
    const leanB = values.filter(v => v < 3).length;
    if (leanA !== leanB) return leanA > leanB ? AXES[axis].a : AXES[axis].b;
    return rand() < 0.5 ? AXES[axis].a : AXES[axis].b;
  });
  const code = testType === 'gk' ? `G-${letters.join('')}` : letters.join('');
  return { testType, code, pct, answers: answers.join('') };
}

// 저장된 결과 (서버 응답)
export interface SavedMbti {
  member_uid: string;
  test_type: TestType;
  mbti_cd: string;
  fb_pct?: number | null;
  cw_pct?: number | null;
  pt_pct?: number | null;
  sl_pct?: number | null;
  update_dt?: string | null;
}

export const savedPct = (s: SavedMbti): Partial<Record<AxisKey, number>> => {
  const pct: Partial<Record<AxisKey, number>> = {};
  if (s.fb_pct != null) pct.FB = s.fb_pct;
  if (s.cw_pct != null) pct.CW = s.cw_pct;
  if (s.pt_pct != null) pct.PT = s.pt_pct;
  if (s.sl_pct != null) pct.SL = s.sl_pct;
  return pct;
};
