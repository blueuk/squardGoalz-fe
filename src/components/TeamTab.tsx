import { useEffect, useState } from 'react';
import api from '../api';
import RadarChart from './RadarChart';
import SoccerBallLoader from './SoccerBallLoader';
import './TeamTab.css';
import {
  POSITIONS,
  DEFAULT_POSITION_WEIGHTS,
  calculatePositionScores,
  calculateRadarScores,
  getCachedPositionWeights,
  setCachedPositionWeights,
} from './positionUtils';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface TeamInfo {
  team_uid: string;
  teamname: string;
  region_cd: string;
  location: string;
  start_time: string;
  end_time: string;
  day_cd: string;
  level_cd: string;
  gender_cd: string;
  comment: string;
  member_count?: number;
}

interface TeamAccount {
  team_uid: string;
  team_account_seq: number;
  bank_cd: string;
  account_enc: string;
}

interface TeamMember {
  team_uid: string;
  member_uid: string;
  member_name: string;
  user_id?: string;
  status_cd?: string;
  terminate_dt?: string;
}

interface MemberScore {
  member_uid: string;
  score_cd: string;
  score_val: string;
}

interface Payment {
  team_uid: string;
  payment_cd: string;
  team_account_seq: number;
  amount: number;
}

interface CommonCd {
  code: string;
  code_name: string;
  reference_1?: string;
}

const TEAM_UID = 'df743e05-9440-4c1e-bfdb-fa07159ef0c9';

const SCORE_CATEGORIES = [
  { id: 'physical',  title: '피지컬',     icon: '💪', color: '#3182f6', bgColor: '#e8f3ff', codes: ['001','002','003','004','015'] },
  { id: 'technique', title: '기술 & 공격', icon: '⚽', color: '#f04452', bgColor: '#fce8e6', codes: ['018','021','022','023','024','025','026'] },
  { id: 'defense',   title: '수비',       icon: '🛡️', color: '#2ecc71', bgColor: '#e6f4ea', codes: ['010','011','012','013','014','016','017'] },
  { id: 'mental',    title: '멘탈 & 센스', icon: '🧠', color: '#ff9500', bgColor: '#fff8e6', codes: ['005','006','007','008','009','019','020','027','028'] },
];

const STAT_NAMES: Record<string, string> = {
  '001':'몸싸움','002':'균형감','003':'체력','004':'스피드','005':'리더십','006':'의사소통',
  '007':'집중력','008':'대담성','009':'침착성','010':'일대일수비','011':'수비지원',
  '012':'수비위치선정','013':'대인마크','014':'가로채기','015':'반사신경','016':'공중볼처리',
  '017':'태클','018':'일대일돌파','019':'연계플레이','020':'공격위치선정','021':'슛파워',
  '022':'슛정확도','023':'패스','024':'롱패스','025':'패스정확도','026':'드리블',
  '027':'시야','028':'일관성',
};

const ALL_SCORE_CODES = Object.keys(STAT_NAMES);

// ─── Position Labels Component ────────────────────────────────────────────────
// [FIX] : 파란색, [PIV] : 빨간색, [ALA] : 초록색, [GOL] : 노란색, [CEN] : 보라색
// 하얀색 글자색에 포지션별 바탕색, 가장 높은 점수 포지션 라벨 앞에 별(★) 표시
export function PositionLabels({
  memberScoreList,
  positionWeights
}: {
  memberScoreList: MemberScore[];
  positionWeights: Record<string, Record<string, number>>;
}) {
  const results = calculatePositionScores(memberScoreList, positionWeights);

  return (
    <div className="position-labels">
      {results.map(pos => (
        <span
          key={pos.code}
          className="position-label"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: pos.bgColor,
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: pos.isHighest ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
            border: pos.isHighest ? '1px solid #fff' : 'none',
            letterSpacing: '-0.3px',
          }}
        >
          {pos.isHighest ? '★' : ''}[{pos.abbr} {pos.scoreStr}]
        </span>
      ))}
    </div>
  );
}

// ─── Weight Editor Component ──────────────────────────────────────────────────
function WeightEditor({
  weights,
  onSave,
  onClose,
  isSaving
}: {
  weights: Record<string, Record<string, number>>;
  onSave: (w: Record<string, Record<string, number>>) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [localWeights, setLocalWeights] = useState<Record<string, Record<string, number>>>(
    JSON.parse(JSON.stringify(weights))
  );
  const [activePos, setActivePos] = useState('FIX');

  const updateWeight = (pos: string, code: string, val: string) => {
    const num = parseFloat(val);
    setLocalWeights(prev => ({
      ...prev,
      [pos]: { ...prev[pos], [code]: isNaN(num) ? 0 : num }
    }));
  };

  const getTotal = (pos: string) => {
    const sum = Object.values(localWeights[pos] ?? {}).reduce((a, b) => a + b, 0);
    return Math.round(sum * 10000) / 10000;
  };

  const currentTotal = getTotal(activePos);
  const isTotalValid = Math.abs(currentTotal - 1) < 0.005;

  const handleSaveClick = () => {
    // 모든 포지션의 가중치 합계가 1인지 검증
    for (const pos of POSITIONS) {
      const tot = getTotal(pos.code);
      if (Math.abs(tot - 1) >= 0.005) {
        alert(`[${pos.name} (${pos.code})] 포지션의 가중치 총합이 1.0이어야 합니다. (현재: ${tot.toFixed(4)})\n가중치를 조정한 후 다시 저장해주세요.`);
        setActivePos(pos.code);
        return;
      }
    }
    onSave(localWeights);
  };

  return (
    <div style={{ border: '1px solid #e5e8eb', borderRadius: '12px', padding: '16px', backgroundColor: '#f9fafb', marginTop: '12px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {POSITIONS.map(pos => {
          const tot = getTotal(pos.code);
          const valid = Math.abs(tot - 1) < 0.005;
          return (
            <button
              key={pos.code}
              onClick={() => setActivePos(pos.code)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activePos === pos.code ? pos.color : '#fff',
                color: activePos === pos.code ? '#fff' : '#4e5968',
                boxShadow: activePos === pos.code ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: activePos === pos.code ? pos.color : (valid ? '#e5e8eb' : '#f04452')
              }}
            >
              {pos.name} ({pos.abbr}) {!valid && '⚠️'}
            </button>
          );
        })}
      </div>

      {/* Total weight indicator */}
      <div style={{
        marginBottom: '10px',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: isTotalValid ? '#e6f4ea' : '#fce8e6',
        color: isTotalValid ? '#137333' : '#c5221f',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>선택 포지션: {POSITIONS.find(p => p.code === activePos)?.name} ({activePos})</span>
        <span>가중치 총합: {currentTotal.toFixed(4)} / 1.0000 {isTotalValid ? '✅' : '⚠️'}</span>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
        {ALL_SCORE_CODES.map(code => (
          <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f2f4f6' }}>
            <span style={{ fontSize: '12px', color: '#8b95a1', width: '28px' }}>{code}</span>
            <span style={{ fontSize: '13px', color: '#191f28', fontWeight: 500, flex: 1 }}>{STAT_NAMES[code]}</span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={localWeights[activePos]?.[code] ?? 0}
              onChange={e => updateWeight(activePos, code, e.target.value)}
              style={{
                width: '76px',
                padding: '4px 6px',
                borderRadius: '6px',
                border: '1px solid #ccd3dc',
                fontSize: '13px',
                textAlign: 'right',
                margin: 0,
                outline: 'none',
                fontWeight: 'bold',
                color: '#191f28'
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          onClick={onClose}
          style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: '#f4f4f4', color: '#4e5968', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
        >
          취소
        </button>
        <button
          onClick={handleSaveClick}
          disabled={isSaving}
          style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--toss-blue, #3182f6)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
        >
          {isSaving ? '저장 중...' : '가중치 저장하기'}
        </button>
      </div>
    </div>
  );
}

// Module-level cache for common codes
let cachedCommonCodes: Record<string, CommonCd[]> | null = null;

// ─── Main Component ───────────────────────────────────────────────────────────
// ── 탈퇴자 목록 헬퍼 (terminate_dt: YYYYMMDDHHMMSS) ──────────────────────────
const nowDtString = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const formatDt = (dt?: string) =>
  dt && dt.length >= 8 ? `${dt.substring(0, 4)}.${dt.substring(4, 6)}.${dt.substring(6, 8)}` : '-';
// 최근 탈퇴자 순
const sortTerminated = (list: TeamMember[]) =>
  [...list].sort((a, b) => (b.terminate_dt || '').localeCompare(a.terminate_dt || ''));

export default function TeamTab({ isAdmin }: { isAdmin?: boolean }) {
  const [subTab, setSubTab] = useState<'INFO' | 'SQUAD'>('INFO');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberScores, setMemberScores] = useState<MemberScore[]>([]);
  const [expandedMemberUid, setExpandedMemberUid] = useState<string | null>(null);

  // Score editing
  const [editingMemberUid, setEditingMemberUid] = useState<string | null>(null);
  const [editingScores, setEditingScores] = useState<Record<string, number>>({});
  const [isSavingScores, setIsSavingScores] = useState(false);

  // Common codes
  const [codeLists, setCodeLists] = useState<Record<string, CommonCd[]>>({
    bank_cd: [], payment_cd: [], region_cd: [], level_cd: [],
    day_cd: [], gender_cd: [], score_cd: [], status_cd: []
  });

  // Team info editing
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TeamInfo>>({});

  // Payment editing
  const [isPaymentEditing, setIsPaymentEditing] = useState(false);
  const [editPayments, setEditPayments] = useState<Payment[]>([]);
  const [editAccounts, setEditAccounts] = useState<TeamAccount[]>([]);

  // Position weights
  const [positionWeights, setPositionWeights] = useState<Record<string, Record<string, number>>>(
    () => getCachedPositionWeights() || DEFAULT_POSITION_WEIGHTS
  );
  const [showWeightEditor, setShowWeightEditor] = useState(false);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Global loading
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Admin map for members with user_id
  const [memberAdminMap, setMemberAdminMap] = useState<Record<string, boolean>>({});

  // Terminated members (관리자 전용)
  const [terminatedMembers, setTerminatedMembers] = useState<TeamMember[]>([]);

  // ── 탈퇴자 목록 로드 (관리자만) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    api.get(`/team_member/terminated/search?team_uid=${TEAM_UID}`)
      .then(res => setTerminatedMembers(sortTerminated(res.data || [])))
      .catch(err => console.error('탈퇴자 목록을 불러오는데 실패했습니다.', err));
  }, [isAdmin]);

  // ── Initial data load (병렬 최적화 & N+1 제거) ───────────────────────────
  useEffect(() => {
    if (teamInfo) return;

    setIsGlobalLoading(true);
    setLoadingMessage('팀 정보를 불러오는 중...');

    const loadInitialData = async () => {
      try {
        const cachedWeights = getCachedPositionWeights();

        // 8개 요청을 병렬로 동시 수행 (N+1 쿼리 및 순차 폭포수 체인 완전 제거)
        const [
          commonCdRes,
          teamInfoRes,
          memberRes,
          accountRes,
          paymentRes,
          scoreRes,
          weightRes,
          userRes
        ] = await Promise.all([
          cachedCommonCodes ? Promise.resolve(null) : api.get('/common_cd/search'),
          api.get('/team_info/search?use_yn=Y'),
          api.get(`/team_member/search?team_uid=${TEAM_UID}`),
          api.get(`/teamAccount/search?team_uid=${TEAM_UID}`),
          api.get(`/payment/search?team_uid=${TEAM_UID}`),
          api.get(`/memberScore/search?team_uid=${TEAM_UID}`),
          cachedWeights ? Promise.resolve(null) : api.get('/position_point/search'),
          api.get('/user/get')
        ]);

        // 1. 공통코드 캐싱 및 반영
        if (cachedCommonCodes) {
          setCodeLists(cachedCommonCodes);
        } else if (commonCdRes?.data) {
          const grouped: Record<string, CommonCd[]> = {
            bank_cd: [], payment_cd: [], region_cd: [], level_cd: [],
            day_cd: [], gender_cd: [], score_cd: [], status_cd: []
          };
          commonCdRes.data.forEach((item: any) => {
            if (!grouped[item.group_cd]) grouped[item.group_cd] = [];
            grouped[item.group_cd].push(item);
          });
          cachedCommonCodes = grouped;
          setCodeLists(grouped);
        }

        // 2. 포지션 가중치 캐싱 및 반영
        if (cachedWeights) {
          setPositionWeights(cachedWeights);
        } else if (weightRes?.data && weightRes.data.length > 0) {
          const loaded: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(DEFAULT_POSITION_WEIGHTS));
          for (const item of weightRes.data) {
            if (!loaded[item.position_cd]) loaded[item.position_cd] = {};
            loaded[item.position_cd][item.score_cd] = parseFloat(item.position_val) || 0;
          }
          setCachedPositionWeights(loaded);
          setPositionWeights(loaded);
        }

        // 3. 관리자 권한 셋 구성 (1회의 /user/get 결과로 즉시 매핑)
        const adminUserSet = new Set<string>();
        if (userRes?.data && Array.isArray(userRes.data)) {
          userRes.data.forEach((u: any) => {
            if (u.auth_cd === '01') adminUserSet.add(u.userid);
          });
        }

        // 4. 팀 멤버 목록 및 관리자 여부 매핑
        let members: TeamMember[] = [];
        if (memberRes?.data) {
          members = memberRes.data.sort((a: any, b: any) =>
            (a.member_name || '').localeCompare(b.member_name || '')
          );
          setTeamMembers(members);

          const adminMap: Record<string, boolean> = {};
          members.forEach(m => {
            if (m.user_id) {
              adminMap[m.member_uid] = adminUserSet.has(m.user_id);
            }
          });
          setMemberAdminMap(adminMap);
        }

        // 5. 팀 정보 세팅
        if (teamInfoRes?.data && teamInfoRes.data.length > 0) {
          const team = teamInfoRes.data[0];
          team.member_count = members.length;
          setTeamInfo(team);
        }

        // 6. 계좌, 결제, 스탯 세팅
        if (accountRes?.data) setTeamAccounts(accountRes.data);
        if (paymentRes?.data) setPayments(paymentRes.data);
        if (scoreRes?.data) setMemberScores(scoreRes.data);

      } catch (err) {
        console.error('팀 정보를 불러오는데 실패했습니다.', err);
      } finally {
        setIsGlobalLoading(false);
      }
    };

    loadInitialData();
  }, [teamInfo]);

  // ── Helper functions ──────────────────────────────────────────────────────
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('계좌번호가 복사되었습니다!'))
      .catch(() => alert('복사에 실패했습니다.'));
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr || timeStr.length !== 4) return timeStr || '';
    return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`;
  };

  const getCodeName = (group: string, codeVal?: string, useRef1?: boolean) => {
    if (!codeVal) return '';
    const item = codeLists[group]?.find(c => c.code === codeVal);
    if (!item) return codeVal;
    return (useRef1 && item.reference_1) ? item.reference_1 : item.code_name;
  };

  // ── Team info editing ─────────────────────────────────────────────────────
  const handleEditClick = () => { if (teamInfo) { setEditForm(teamInfo); setIsEditing(true); } };
  const handleCancelClick = () => setIsEditing(false);
  const handleSaveClick = async () => {
    if (!teamInfo || !editForm.team_uid) return;
    setIsGlobalLoading(true);
    setLoadingMessage('팀 정보를 저장하는 중...');
    try {
      await api.post('/team_info/update', editForm);
      setTeamInfo({ ...teamInfo, ...editForm });
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (err) { console.error(err); alert('수정에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Payment editing ───────────────────────────────────────────────────────
  const handlePaymentEditClick = () => {
    setEditPayments(JSON.parse(JSON.stringify(payments)));
    setEditAccounts(JSON.parse(JSON.stringify(teamAccounts)));
    setIsPaymentEditing(true);
  };
  const handlePaymentCancelClick = () => setIsPaymentEditing(false);
  const handlePaymentSaveClick = async () => {
    setIsGlobalLoading(true);
    setLoadingMessage('입금 안내를 저장하는 중...');
    try {
      for (const p of editPayments) await api.post('/payment/update', p);
      for (const a of editAccounts) await api.post('/teamAccount/update', a);
      setPayments(editPayments);
      setTeamAccounts(editAccounts);
      setIsPaymentEditing(false);
      alert('입금 안내가 수정되었습니다.');
    } catch (err) { console.error(err); alert('수정에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };
  const updateEditPayment = (idx: number, field: string, value: any) => {
    const arr = [...editPayments];
    arr[idx] = { ...arr[idx], [field]: value };
    setEditPayments(arr);
  };
  const updateEditAccount = (seq: number, field: string, value: any) => {
    const arr = [...editAccounts];
    const idx = arr.findIndex(a => a.team_account_seq === seq);
    if (idx !== -1) { arr[idx] = { ...arr[idx], [field]: value }; setEditAccounts(arr); }
  };

  // ── Member status ─────────────────────────────────────────────────────────
  const updateMemberStatus = async (memberUid: string, newStatusCd: string) => {
    setIsGlobalLoading(true);
    setLoadingMessage('상태를 변경하는 중...');
    try {
      await api.post('/team_member/update', { team_uid: TEAM_UID, member_uid: memberUid, status_cd: newStatusCd });
      setTeamMembers(prev => prev.map(m => m.member_uid === memberUid ? { ...m, status_cd: newStatusCd } : m));
    } catch (err) { console.error(err); alert('상태 변경에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Score editing ─────────────────────────────────────────────────────────
  const handleStartEditScores = (memberUid: string) => {
    const scoresForMember = memberScores.filter(s => s.member_uid === memberUid);
    const scoreMap: Record<string, number> = {};
    ALL_SCORE_CODES.forEach(code => {
      const found = scoresForMember.find(s => s.score_cd === code);
      scoreMap[code] = found ? parseInt(found.score_val, 10) || 13 : 13;
    });
    setEditingScores(scoreMap);
    setEditingMemberUid(memberUid);
  };
  const handleCancelEditScores = () => { setEditingMemberUid(null); setEditingScores({}); };
  const handleScoreFieldChange = (scoreCd: string, val: string) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 20) num = 20;
    setEditingScores(prev => ({ ...prev, [scoreCd]: num }));
  };
  const handleSaveScores = async () => {
    if (!editingMemberUid || isSavingScores) return;
    setIsSavingScores(true);
    setIsGlobalLoading(true);
    setLoadingMessage('선수 능력치를 저장하는 중...');
    try {
      const promises = Object.entries(editingScores).map(async ([scoreCd, val]) => {
        try {
          await api.post('/memberScore/update', { team_uid: TEAM_UID, member_uid: editingMemberUid, year: '2026', score_cd: scoreCd, score_val: val.toString() });
        } catch (err: any) {
          if (err.response?.status === 404) {
            await api.post('/memberScore/insert', { team_uid: TEAM_UID, member_uid: editingMemberUid, year: '2026', score_cd: scoreCd, score_val: val.toString() });
          }
        }
      });
      await Promise.all(promises);
      setMemberScores(prev => {
        const without = prev.filter(s => s.member_uid !== editingMemberUid);
        const updated = Object.entries(editingScores).map(([score_cd, val]) => ({
          member_uid: editingMemberUid!, score_cd, score_val: val.toString()
        }));
        return [...without, ...updated];
      });
      alert('선수 능력치가 성공적으로 저장되었습니다.');
      setEditingMemberUid(null);
      setEditingScores({});
    } catch (e) {
      console.error(e); alert('능력치 저장에 실패했습니다.');
    } finally {
      setIsSavingScores(false);
      setIsGlobalLoading(false);
    }
  };

  // ── Add member ────────────────────────────────────────────────────────────
  const handleAddMember = async () => {
    if (!newMemberName.trim() || isAddingMember) return;
    setIsAddingMember(true);
    setIsGlobalLoading(true);
    setLoadingMessage('선수를 추가하는 중...');
    try {
      await api.post('/team_member/insert', {
        members: [{ team_uid: TEAM_UID, member_name: newMemberName.trim(), status_cd: '01' }]
      });
      // Reload members, scores, users in parallel
      const [mRes, sRes, uRes] = await Promise.all([
        api.get(`/team_member/search?team_uid=${TEAM_UID}`),
        api.get(`/memberScore/search?team_uid=${TEAM_UID}`),
        api.get('/user/get')
      ]);
      const sorted = (mRes.data || []).sort((a: any, b: any) =>
        (a.member_name || '').localeCompare(b.member_name || '')
      );
      setTeamMembers(sorted);
      if (teamInfo) setTeamInfo({ ...teamInfo, member_count: sorted.length });
      setMemberScores(sRes.data || []);

      const adminUserSet = new Set<string>();
      if (uRes?.data && Array.isArray(uRes.data)) {
        uRes.data.forEach((u: any) => { if (u.auth_cd === '01') adminUserSet.add(u.userid); });
      }
      const adminMap: Record<string, boolean> = {};
      sorted.forEach((m: TeamMember) => {
        if (m.user_id) adminMap[m.member_uid] = adminUserSet.has(m.user_id);
      });
      setMemberAdminMap(adminMap);

      setNewMemberName('');
      setShowAddMember(false);
      alert(`[${newMemberName.trim()}] 선수가 추가되었습니다. (기본 능력치 13점 부여)`);
    } catch (err) { console.error(err); alert('선수 추가에 실패했습니다.'); }
    finally { setIsAddingMember(false); setIsGlobalLoading(false); }
  };

  // ── Terminate member (탈퇴자 목록으로 이동) ─────────────────────────────────
  const handleDeleteMember = async (member: TeamMember) => {
    if (!window.confirm(`[${member.member_name}] 선수를 탈퇴 처리하시겠습니까?\n탈퇴자 목록으로 이동되며, 이후 복구할 수 있습니다.`)) return;
    setIsGlobalLoading(true);
    setLoadingMessage('선수를 탈퇴 처리하는 중...');
    try {
      await api.post('/team_member/terminate', { team_uid: TEAM_UID, member_uid: member.member_uid });
      setTeamMembers(prev => prev.filter(m => m.member_uid !== member.member_uid));
      setTerminatedMembers(prev => sortTerminated([...prev, { ...member, terminate_dt: nowDtString() }]));
      if (teamInfo) setTeamInfo({ ...teamInfo, member_count: Math.max(0, (teamInfo.member_count || 1) - 1) });
      if (expandedMemberUid === member.member_uid) setExpandedMemberUid(null);
      alert(`[${member.member_name}] 선수가 탈퇴자 목록으로 이동되었습니다.`);
    } catch (err) { console.error(err); alert('선수 탈퇴 처리에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Restore member (선수단 목록으로 복구) ──────────────────────────────────
  const handleRestoreMember = async (member: TeamMember) => {
    if (!window.confirm(`[${member.member_name}] 선수를 선수단으로 복구하시겠습니까?`)) return;
    setIsGlobalLoading(true);
    setLoadingMessage('선수를 복구하는 중...');
    try {
      await api.post('/team_member/restore', { team_uid: TEAM_UID, member_uid: member.member_uid });
      setTerminatedMembers(prev => prev.filter(m => m.member_uid !== member.member_uid));
      setTeamMembers(prev => [...prev, { ...member, terminate_dt: undefined }].sort((a, b) =>
        (a.member_name || '').localeCompare(b.member_name || '')
      ));
      if (teamInfo) setTeamInfo({ ...teamInfo, member_count: (teamInfo.member_count || 0) + 1 });
      alert(`[${member.member_name}] 선수가 복구되었습니다.`);
    } catch (err) { console.error(err); alert('선수 복구에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Purge member (완전 삭제) ───────────────────────────────────────────────
  const handlePurgeMember = async (member: TeamMember) => {
    if (!window.confirm(`[${member.member_name}] 선수를 완전 삭제하시겠습니까?\n능력치, 투표, 기록 데이터가 모두 삭제되며 되돌릴 수 없습니다.`)) return;
    setIsGlobalLoading(true);
    setLoadingMessage('선수를 완전 삭제하는 중...');
    try {
      await api.post('/team_member/delete', { team_uid: TEAM_UID, member_uid: member.member_uid });
      setTerminatedMembers(prev => prev.filter(m => m.member_uid !== member.member_uid));
      setMemberScores(prev => prev.filter(s => s.member_uid !== member.member_uid));
      alert(`[${member.member_name}] 선수가 완전 삭제되었습니다.`);
    } catch (err) { console.error(err); alert('선수 완전 삭제에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Admin grant/revoke ────────────────────────────────────────────────────
  const handleToggleAdmin = async (member: TeamMember) => {
    if (!member.user_id) return;
    const currentIsAdmin = memberAdminMap[member.member_uid] ?? false;
    const newAuthCd = currentIsAdmin ? '02' : '01';
    const action = currentIsAdmin ? '관리자를 해제' : '관리자로 지정';
    if (!window.confirm(`[${member.member_name}] 선수를 ${action}하시겠습니까?`)) return;
    setIsGlobalLoading(true);
    setLoadingMessage('권한을 변경하는 중...');
    try {
      await api.post('/user/update', { userid: member.user_id, auth_cd: newAuthCd });
      setMemberAdminMap(prev => ({ ...prev, [member.member_uid]: !currentIsAdmin }));
      alert(`[${member.member_name}] 선수를 ${action}했습니다.`);
    } catch (err) { console.error(err); alert('권한 변경에 실패했습니다.'); }
    finally { setIsGlobalLoading(false); }
  };

  // ── Position weight save ──────────────────────────────────────────────────
  const handleSaveWeights = async (weights: Record<string, Record<string, number>>) => {
    setIsSavingWeights(true);
    setIsGlobalLoading(true);
    setLoadingMessage('포지션 가중치를 저장하는 중...');
    try {
      const items = [];
      for (const pos of POSITIONS) {
        for (const code of ALL_SCORE_CODES) {
          items.push({ position_cd: pos.code, score_cd: code, position_val: weights[pos.code]?.[code] ?? 0 });
        }
      }
      await api.post('/position_point/bulk_upsert', { items });
      setCachedPositionWeights(weights);
      setPositionWeights(weights);
      setShowWeightEditor(false);
      alert('포지션 가중치가 성공적으로 저장되었습니다.');
    } catch (err) { console.error(err); alert('가중치 저장에 실패했습니다.'); }
    finally {
      setIsSavingWeights(false);
      setIsGlobalLoading(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0px', backgroundColor: '#f9f9f9', minHeight: '100vh', paddingBottom: editingMemberUid ? '140px' : '70px' }}>
      <SoccerBallLoader visible={isGlobalLoading} message={loadingMessage} />

      {/* Sub Tab Navigation (Toss Segmented Control) */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, backgroundColor: '#fff',
        padding: '12px 20px', borderBottom: '1px solid #f2f4f6',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', backgroundColor: '#f2f4f6', borderRadius: '24px', padding: '4px', gap: '4px' }}>
          {(['INFO', 'SQUAD'] as const).map(tab => (
            <button key={tab} onClick={() => setSubTab(tab)} style={{
              flex: 1, padding: '10px 0', borderRadius: '20px', border: 'none',
              backgroundColor: subTab === tab ? '#fff' : 'transparent',
              color: subTab === tab ? '#191f28' : '#8b95a1',
              fontWeight: subTab === tab ? '700' : '500',
              fontSize: 'calc(14px * var(--scale-factor, 1))',
              boxShadow: subTab === tab ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {tab === 'INFO' ? '팀관리' : '선수단'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* ══ INFO TAB ══════════════════════════════════════════════════════ */}
        {subTab === 'INFO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Team Info Card */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>⚽ 팀 정보</h3>
                {isAdmin && !isEditing && (
                  <button onClick={handleEditClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>수정</button>
                )}
                {isAdmin && isEditing && (
                  <div>
                    <button onClick={handleCancelClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' }}>취소</button>
                    <button onClick={handleSaveClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>저장</button>
                  </div>
                )}
              </div>

              {teamInfo ? (
                isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                    {[
                      { label: '팀명', key: 'teamname', type: 'text' },
                      { label: '주구장', key: 'location', type: 'text' },
                      { label: '시작시간', key: 'start_time', type: 'text', placeholder: 'HHMM' },
                      { label: '종료시간', key: 'end_time', type: 'text', placeholder: 'HHMM' },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#888', width: '70px' }}>{label}</span>
                        <input type="text" value={(editForm as any)[key] || ''} placeholder={placeholder}
                          onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                          style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', margin: 0, marginBottom: 0 }} />
                      </div>
                    ))}
                    {[
                      { label: '지역', key: 'region_cd', list: 'region_cd' },
                      { label: '활동요일', key: 'day_cd', list: 'day_cd' },
                      { label: '실력', key: 'level_cd', list: 'level_cd' },
                    ].map(({ label, key, list }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#888', width: '70px' }}>{label}</span>
                        <select value={(editForm as any)[key] || ''} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                          style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', margin: 0, marginBottom: 0 }}>
                          <option value="">선택</option>
                          {codeLists[list]?.map(c => <option key={c.code} value={c.code}>{c.code_name}{c.reference_1 ? ` (${c.reference_1})` : ''}</option>)}
                        </select>
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#888', marginBottom: '5px' }}>코멘트</span>
                      <textarea value={editForm.comment || ''} onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#555' }}>
                    {[
                      { label: '팀명', value: teamInfo.teamname },
                      { label: '지역', value: getCodeName('region_cd', teamInfo.region_cd) },
                      { label: '활동요일', value: getCodeName('day_cd', teamInfo.day_cd) },
                      { label: '주구장', value: teamInfo.location },
                      { label: '운동 시간', value: `${formatTime(teamInfo.start_time)} ~ ${formatTime(teamInfo.end_time)}` },
                      { label: '실력', value: getCodeName('level_cd', teamInfo.level_cd, true) },
                      { label: '회원 수', value: `${teamInfo.member_count}명` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>{label}</span>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f4f4f4', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                      "{teamInfo.comment}"
                    </div>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>팀 정보를 불러오는 중입니다...</div>
              )}
            </div>

            {/* Payment Card */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>💸 입금 안내</h3>
                {isAdmin && !isPaymentEditing && (
                  <button onClick={handlePaymentEditClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>수정</button>
                )}
                {isAdmin && isPaymentEditing && (
                  <div>
                    <button onClick={handlePaymentCancelClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' }}>취소</button>
                    <button onClick={handlePaymentSaveClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>저장</button>
                  </div>
                )}
              </div>

              {!isPaymentEditing ? (
                payments.length > 0 ? (
                  payments.map(payment => {
                    const account = teamAccounts.find(a => a.team_account_seq === payment.team_account_seq);
                    const bankName = getCodeName('bank_cd', account?.bank_cd) || '알 수 없음';
                    const paymentName = getCodeName('payment_cd', payment.payment_cd) || (payment.payment_cd === '01' ? '월회비' : '지각비');
                    const isMonthly = payment.payment_cd === '01';
                    const primaryColor = isMonthly ? '#3182f6' : '#f04452';
                    return (
                      <div key={payment.payment_cd} style={{ marginBottom: '20px' }}>
                        <div style={{ fontWeight: 'bold', color: primaryColor, marginBottom: '5px' }}>{paymentName} 안내</div>
                        <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                          {Number(payment.amount).toLocaleString()}원
                          {isMonthly && <><br />(상/하반기 일시납 각 6만원)</>}
                        </div>
                        {account && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f4f4', padding: '10px 15px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '14px', color: '#333' }}>
                              <strong>{bankName}</strong> {account.account_enc}<br />
                              <span style={{ fontSize: '12px', color: '#888' }}>예금주: {isMonthly ? '이진범' : '강승지'}</span>
                            </div>
                            <button onClick={() => copyToClipboard(account.account_enc)}
                              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                              복사
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '20px 0' }}>등록된 입금 안내가 없습니다.</div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {editPayments.map((payment, idx) => {
                    const account = editAccounts.find(a => a.team_account_seq === payment.team_account_seq);
                    return (
                      <div key={idx} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>종류</span>
                          <select value={payment.payment_cd} onChange={e => updateEditPayment(idx, 'payment_cd', e.target.value)}
                            style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', margin: 0 }}>
                            {codeLists.payment_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>금액</span>
                          <input type="number" value={Number(payment.amount).toString()} onChange={e => updateEditPayment(idx, 'amount', Number(e.target.value))}
                            style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', margin: 0 }} />
                        </div>
                        {account && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>은행</span>
                              <select value={account.bank_cd} onChange={e => updateEditAccount(account.team_account_seq, 'bank_cd', e.target.value)}
                                style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', margin: 0 }}>
                                {codeLists.bank_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                              </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>계좌</span>
                              <input type="text" value={account.account_enc} onChange={e => updateEditAccount(account.team_account_seq, 'account_enc', e.target.value)}
                                style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', margin: 0 }} />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Position Weight Section (Admin only) */}
            {isAdmin && (
              <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#191f28', margin: 0 }}>⚖️ 포지션 가중치 관리</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8b95a1' }}>
                      포지션별 스탯 가중치를 설정합니다. (각 포지션별 총합: 1.0)
                    </p>
                  </div>
                  <button onClick={() => setShowWeightEditor(!showWeightEditor)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      backgroundColor: showWeightEditor ? '#e8f3ff' : '#f2f4f6',
                      color: showWeightEditor ? 'var(--toss-blue, #3182f6)' : '#4e5968',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}>
                    {showWeightEditor ? '가중치 닫기 ▴' : '가중치 수정 ▾'}
                  </button>
                </div>
                {showWeightEditor && (
                  <WeightEditor
                    weights={positionWeights}
                    onSave={handleSaveWeights}
                    onClose={() => setShowWeightEditor(false)}
                    isSaving={isSavingWeights}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ SQUAD TAB ═════════════════════════════════════════════════════ */}
        {subTab === 'SQUAD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="card squad-card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>

              {/* Squad Header */}
              <div className="squad-header">
                <div className="squad-header-title">
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#191f28', margin: '0 0 4px 0' }}>🏃 선수단 명단</h3>
                  <p style={{ fontSize: '13px', color: '#8b95a1', margin: 0 }}>
                    {isAdmin ? '선수를 탭하면 능력치를 확인하고 수정할 수 있습니다.' : '선수를 탭하면 6각형 능력치 레이더를 확인할 수 있습니다.'}
                  </p>
                </div>
                <div className="squad-header-actions">
                  <span style={{ backgroundColor: '#f2f4f6', padding: '6px 12px', borderRadius: '14px', fontSize: '13px', fontWeight: 'bold', color: '#4e5968' }}>
                    총 {teamMembers.length}명
                  </span>
                  {isAdmin && (
                    <button onClick={() => setShowAddMember(true)}
                      style={{ padding: '6px 14px', fontSize: '13px', backgroundColor: '#e8f3ff', color: 'var(--toss-blue, #3182f6)', border: '1px solid var(--toss-blue, #3182f6)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                      + 선수 추가
                    </button>
                  )}
                </div>
              </div>

              {/* Add Member Form */}
              {showAddMember && (
                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8faff', borderRadius: '12px', border: '1px solid #c0d8ff' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#191f28', marginBottom: '10px' }}>➕ 신규 선수 등록</div>
                  <input
                    type="text"
                    placeholder="선수 이름을 입력하세요"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddMember(); }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccd3dc', fontSize: '14px', marginBottom: '10px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setShowAddMember(false); setNewMemberName(''); }}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f4f4f4', color: '#4e5968', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      취소
                    </button>
                    <button onClick={handleAddMember} disabled={isAddingMember || !newMemberName.trim()}
                      style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--toss-blue, #3182f6)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      {isAddingMember ? '추가 중...' : '등록하기 (기본 13점)'}
                    </button>
                  </div>
                </div>
              )}

              {/* Member List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {teamMembers.map(member => {
                  const isExpanded = expandedMemberUid === member.member_uid;
                  const isEditingThisMember = editingMemberUid === member.member_uid;
                  const memberScoreList = memberScores.filter(s => s.member_uid === member.member_uid);

                  const avgScore = (() => {
                    if (memberScoreList.length === 0) return '13.0';
                    const sum = memberScoreList.reduce((acc, curr) => acc + (parseFloat(curr.score_val) || 0), 0);
                    return (sum / memberScoreList.length).toFixed(1);
                  })();

                  let bgColor = '#e6f4ea'; let statusColor = '#137333';
                  if (member.status_cd === '02') { bgColor = '#fce8e6'; statusColor = '#c5221f'; }
                  else if (member.status_cd === '03') { bgColor = '#f1f3f4'; statusColor = '#5f6368'; }

                  const radarScores = calculateRadarScores(memberScoreList);

                  return (
                    <div key={member.member_uid} style={{
                      border: isExpanded ? '1.5px solid var(--toss-blue)' : '1px solid #f2f4f6',
                      borderRadius: '16px', backgroundColor: '#fff',
                      boxShadow: isExpanded ? '0 4px 16px rgba(49,130,246,0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                      overflow: 'hidden', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                      {/* Card Header */}
                      <div onClick={() => {
                        if (editingMemberUid && editingMemberUid !== member.member_uid) {
                          if (!window.confirm('편집 중인 내용이 저장되지 않았습니다. 다른 선수로 이동하시겠습니까?')) return;
                          handleCancelEditScores();
                        }
                        setExpandedMemberUid(isExpanded ? null : member.member_uid);
                      }} className={`member-card-header${isAdmin ? ' member-card-header--admin' : ''}`} style={{
                        padding: '14px 16px', backgroundColor: isExpanded ? '#fbfcfe' : '#fff', cursor: 'pointer'
                      }}>
                        <div className="member-card-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                            <span className="member-card-name" style={{ fontWeight: 'bold', fontSize: '16px', color: '#191f28' }}>{member.member_name}</span>
                            {member.user_id && (
                              <span style={{ backgroundColor: '#FEE500', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>K</span>
                            )}
                            <span style={{ backgroundColor: bgColor, color: statusColor, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                              {getCodeName('status_cd', member.status_cd) || '상태 없음'}
                            </span>
                          </div>
                          {/* Position score pills: FIX, CEN, ALA, PIV, GOL with white text on position color */}
                          <PositionLabels memberScoreList={memberScoreList} positionWeights={positionWeights} />
                        </div>

                        <div className="member-card-actions">
                          {isAdmin && (
                            <>
                              <select onClick={e => e.stopPropagation()} value={member.status_cd || '01'}
                                onChange={e => updateMemberStatus(member.member_uid, e.target.value)}
                                style={{ fontSize: '12px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', margin: 0 }}>
                                {codeLists.status_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                              </select>
                              {member.user_id && (
                                <button onClick={e => { e.stopPropagation(); handleToggleAdmin(member); }}
                                  style={{
                                    fontSize: '11px', padding: '4px 7px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                                    backgroundColor: memberAdminMap[member.member_uid] ? '#fce8e6' : '#e8f3ff',
                                    color: memberAdminMap[member.member_uid] ? '#f04452' : '#3182f6'
                                  }}>
                                  {memberAdminMap[member.member_uid] ? '관리자 해제' : '관리자 부여'}
                                </button>
                              )}
                              <button onClick={e => { e.stopPropagation(); handleDeleteMember(member); }}
                                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#fce8e6', color: '#f04452', cursor: 'pointer', fontWeight: 'bold' }}>
                                🗑️
                              </button>
                            </>
                          )}
                          {/* 화살표 전용 토글 버튼 (스탯보기/스탯접기 문구 제거) */}
                          <span style={{
                            fontSize: '14px', fontWeight: 'bold',
                            color: isExpanded ? 'var(--toss-blue, #3182f6)' : '#8b95a1',
                            backgroundColor: isExpanded ? 'var(--toss-light-blue, #e8f3ff)' : '#f2f4f6',
                            width: '32px', height: '32px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}>
                            {isExpanded ? '▴' : '▾'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="member-expanded" style={{ backgroundColor: '#ffffff', borderTop: '1px solid #f2f4f6' }}>
                          {/* 6각형 그래프 영역 (모든 사용자에게 노출) */}
                          <div className="radar-box" style={{ marginBottom: '18px', padding: '14px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #f2f4f6', textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4e5968', marginBottom: '8px' }}>
                              📊 능력치 6각형 레이더
                            </div>
                            <RadarChart scores={radarScores} size={220} showValues={isAdmin} />
                          </div>

                          {/* Stats header bar */}
                          <div className="report-header" style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f2f4f6' }}>
                            <div className="report-header-title">
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#191f28' }}>능력치 리포트</span>
                              {isAdmin ? (
                                <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: 'bold', backgroundColor: 'var(--toss-light-blue)', padding: '2px 8px', borderRadius: '8px' }}>
                                  ⭐ 평균 {avgScore}점
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#8b95a1', backgroundColor: '#f2f4f6', padding: '2px 8px', borderRadius: '8px' }}>
                                  🔒 상세 수치 비공개
                                </span>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="report-header-action">
                                {!isEditingThisMember ? (
                                  <button onClick={e => { e.stopPropagation(); handleStartEditScores(member.member_uid); }}
                                    className="vote-action-btn"
                                    style={{ padding: '6px 14px', backgroundColor: 'var(--toss-light-blue)', color: 'var(--toss-blue)', borderRadius: '8px', fontSize: '12px' }}>
                                    수정하기 ✏️
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: 'bold' }}>✍️ 편집 중 (0~20점)</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Grouped Stats Categories */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {SCORE_CATEGORIES.map(category => {
                              const catScores = category.codes.map(code => {
                                const found = memberScoreList.find(s => s.score_cd === code);
                                return isEditingThisMember ? (editingScores[code] ?? 13) : (found ? parseInt(found.score_val, 10) : 13);
                              });
                              const catAvg = (catScores.reduce((a, b) => a + b, 0) / catScores.length).toFixed(1);

                              return (
                                <div key={category.id} style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '12px 14px', border: '1px solid #f2f4f6' }}>
                                  <div className="report-category-header" style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '14px' }}>{category.icon}</span>
                                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333d4b' }}>{category.title}</span>
                                    </div>
                                    {isAdmin && (
                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: category.color, backgroundColor: category.bgColor, padding: '2px 8px', borderRadius: '10px' }}>
                                        평균 {catAvg}
                                      </span>
                                    )}
                                  </div>

                                  <div className="report-grid">
                                    {category.codes.map(code => {
                                      const codeObj = codeLists.score_cd?.find(c => c.code === code);
                                      const codeName = codeObj?.code_name || STAT_NAMES[code] || code;
                                      const existing = memberScoreList.find(s => s.score_cd === code);
                                      const scoreVal = isEditingThisMember ? (editingScores[code] ?? 13) : (existing ? parseInt(existing.score_val, 10) : 13);

                                      return (
                                        <div key={code} className="report-item" style={{
                                          backgroundColor: '#fff', padding: '8px 10px', borderRadius: '8px',
                                          border: isEditingThisMember ? '1px solid #d0d7de' : '1px solid #f2f4f6',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                        }}>
                                          <span className="report-item-name" style={{ fontSize: '12px', color: '#4e5968', fontWeight: 500 }}>{codeName}</span>

                                          {/* 권한이 관리자인 경우만 수치 노출, 일반 사용자는 잠금 표시 */}
                                          {isAdmin ? (
                                            isEditingThisMember ? (
                                              <input type="number" min="0" max="20"
                                                value={editingScores[code] ?? 13}
                                                onChange={e => handleScoreFieldChange(code, e.target.value)}
                                                style={{
                                                  width: '46px', textAlign: 'center', padding: '4px', borderRadius: '6px',
                                                  border: '1px solid var(--toss-blue)', fontSize: '13px', fontWeight: 'bold',
                                                  color: '#191f28', backgroundColor: '#f8faff', outline: 'none', margin: 0
                                                }} />
                                            ) : (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '32px', height: '4px', backgroundColor: '#eef0f2', borderRadius: '2px', overflow: 'hidden' }}>
                                                  <div style={{
                                                    width: `${Math.min(100, (scoreVal / 20) * 100)}%`, height: '100%',
                                                    backgroundColor: scoreVal >= 15 ? 'var(--toss-blue)' : scoreVal >= 10 ? 'var(--toss-green)' : 'var(--toss-orange)',
                                                    borderRadius: '2px'
                                                  }} />
                                                </div>
                                                <span style={{
                                                  fontSize: '13px', fontWeight: 'bold', minWidth: '18px', textAlign: 'right',
                                                  color: scoreVal >= 15 ? 'var(--toss-blue)' : scoreVal >= 10 ? '#191f28' : '#8b95a1'
                                                }}>{scoreVal}</span>
                                              </div>
                                            )
                                          ) : (
                                            <span style={{ fontSize: '12px', color: '#c5cdd7', fontWeight: 'bold' }}>🔒</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminated Members (관리자 전용) */}
            {isAdmin && (
              <div className="card squad-card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div className="squad-header">
                  <div className="squad-header-title">
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#191f28', margin: '0 0 4px 0' }}>🚪 탈퇴자 목록</h3>
                    <p style={{ fontSize: '13px', color: '#8b95a1', margin: 0 }}>
                      관리자만 볼 수 있습니다. 복구하거나 완전 삭제할 수 있습니다.
                    </p>
                  </div>
                  <div className="squad-header-actions">
                    <span style={{ backgroundColor: '#f2f4f6', padding: '6px 12px', borderRadius: '14px', fontSize: '13px', fontWeight: 'bold', color: '#4e5968' }}>
                      총 {terminatedMembers.length}명
                    </span>
                  </div>
                </div>

                {terminatedMembers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#8b95a1', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                    탈퇴한 선수가 없습니다.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {terminatedMembers.map(member => (
                      <div key={member.member_uid} className="terminated-row" style={{
                        padding: '12px 16px', border: '1px solid #f2f4f6', borderRadius: '14px', backgroundColor: '#f9fafb'
                      }}>
                        <div className="member-card-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="member-card-name" style={{ fontWeight: 'bold', fontSize: '15px', color: '#4e5968' }}>{member.member_name}</span>
                            {member.user_id && (
                              <span style={{ backgroundColor: '#FEE500', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>K</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8b95a1', marginTop: '2px' }}>
                            탈퇴일 {formatDt(member.terminate_dt)}
                          </div>
                        </div>
                        <div className="member-card-actions">
                          <button onClick={() => handleRestoreMember(member)}
                            style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: 'none', backgroundColor: '#e8f3ff', color: '#3182f6', cursor: 'pointer', fontWeight: 'bold' }}>
                            복구
                          </button>
                          <button onClick={() => handlePurgeMember(member)}
                            style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: 'none', backgroundColor: '#fce8e6', color: '#f04452', cursor: 'pointer', fontWeight: 'bold' }}>
                            완전 삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Save Bar */}
      {editingMemberUid && (
        <div style={{
          position: 'fixed', bottom: '50px', left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '1200px', backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          borderTop: '1px solid #f2f4f6', padding: '12px 20px',
          display: 'flex', gap: '12px', zIndex: 1050, boxSizing: 'border-box'
        }}>
          <button onClick={handleCancelEditScores} disabled={isSavingScores}
            className="vote-action-btn"
            style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: '#f2f4f6', color: '#4e5968', fontSize: '15px' }}>
            취소
          </button>
          <button onClick={handleSaveScores} disabled={isSavingScores}
            className="vote-action-btn"
            style={{ flex: 2, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--toss-blue)', color: '#fff', fontSize: '15px' }}>
            {isSavingScores ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}
    </div>
  );
}
