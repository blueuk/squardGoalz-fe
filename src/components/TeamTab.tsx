import { useEffect, useState } from 'react';
import api from '../api';

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

const SCORE_CATEGORIES = [
  {
    id: 'physical',
    title: '피지컬',
    icon: '💪',
    color: '#3182f6',
    bgColor: '#e8f3ff',
    codes: ['001', '002', '003', '004', '015']
  },
  {
    id: 'technique',
    title: '기술 & 공격',
    icon: '⚽',
    color: '#f04452',
    bgColor: '#fce8e6',
    codes: ['018', '021', '022', '023', '024', '025', '026']
  },
  {
    id: 'defense',
    title: '수비',
    icon: '🛡️',
    color: '#2ecc71',
    bgColor: '#e6f4ea',
    codes: ['010', '011', '012', '013', '014', '016', '017']
  },
  {
    id: 'mental',
    title: '멘탈 & 센스',
    icon: '🧠',
    color: '#ff9500',
    bgColor: '#fff8e6',
    codes: ['005', '006', '007', '008', '009', '019', '020', '027', '028']
  }
];

export default function TeamTab({ isAdmin }: { isAdmin?: boolean }) {
  const [subTab, setSubTab] = useState<'INFO' | 'SQUAD'>('INFO');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberScores, setMemberScores] = useState<MemberScore[]>([]);
  const [expandedMemberUid, setExpandedMemberUid] = useState<string | null>(null);

  // 스탯 편집 모드 상태
  const [editingMemberUid, setEditingMemberUid] = useState<string | null>(null);
  const [editingScores, setEditingScores] = useState<Record<string, number>>({});
  const [isSavingScores, setIsSavingScores] = useState(false);
  
  // 공통 코드 원본 배열 저장 (Select 박스용)
  const [codeLists, setCodeLists] = useState<Record<string, CommonCd[]>>({
    bank_cd: [],
    payment_cd: [],
    region_cd: [],
    level_cd: [],
    day_cd: [],
    gender_cd: [],
    score_cd: [],
    status_cd: []
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TeamInfo>>({});

  // 입금안내 수정 모드 상태
  const [isPaymentEditing, setIsPaymentEditing] = useState(false);
  const [editPayments, setEditPayments] = useState<Payment[]>([]);
  const [editAccounts, setEditAccounts] = useState<TeamAccount[]>([]);

  useEffect(() => {
    if (subTab === 'INFO' && !teamInfo) {
      // 1. 공통 코드 모두 가져오기
      const groupCds = ['bank_cd', 'payment_cd', 'region_cd', 'level_cd', 'day_cd', 'gender_cd', 'score_cd', 'status_cd'];
      
      Promise.all(groupCds.map(g => api.get(`/common_cd/search?group_cd=${g}`)))
        .then(results => {
          const newCodeLists: Record<string, CommonCd[]> = {};
          results.forEach((res, i) => {
            const group = groupCds[i];
            newCodeLists[group] = res.data;
          });
          setCodeLists(prev => ({ ...prev, ...newCodeLists }));
        })
        .catch(console.error);

      // 2. 팀 정보 가져오기
      api.get('/team_info/search?use_yn=Y')
        .then((res) => {
          if (res.data && res.data.length > 0) {
            const team = res.data[0];
            
            // 3. 멤버 수 가져오기
            api.get(`/team_member/search?team_uid=${team.team_uid}`)
              .then(memberRes => {
                team.member_count = memberRes.data.length;
                setTeamInfo(team);
                
                // 가나다 순 정렬
                const sorted = memberRes.data.sort((a: any, b: any) => {
                  const nameA = a.member_name || '';
                  const nameB = b.member_name || '';
                  return nameA.localeCompare(nameB);
                });
                setTeamMembers(sorted);
              })
              .catch(() => {
                team.member_count = 0;
                setTeamInfo(team);
              });
            
            // 4. 계좌 정보 및 결제 가져오기
            api.get(`/teamAccount/search?team_uid=${team.team_uid}`).then(r => setTeamAccounts(r.data)).catch(console.error);
            api.get(`/payment/search?team_uid=${team.team_uid}`).then(r => setPayments(r.data)).catch(console.error);
            api.get(`/memberScore/search?team_uid=${team.team_uid}`).then(r => setMemberScores(r.data)).catch(console.error);
          }
        })
        .catch((err) => {
          console.error("팀 정보를 불러오는데 실패했습니다.", err);
        });
    }
  }, [subTab, teamInfo]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("계좌번호가 복사되었습니다!");
    }).catch(err => {
      console.error("복사 실패:", err);
      alert("복사에 실패했습니다.");
    });
  };

  const handleEditClick = () => {
    if (teamInfo) {
      setEditForm(teamInfo);
      setIsEditing(true);
    }
  };

  const handleSaveClick = async () => {
    if (!teamInfo || !editForm.team_uid) return;
    try {
      await api.post('/team_info/update', editForm);
      setTeamInfo({ ...teamInfo, ...editForm });
      setIsEditing(false);
      alert("수정되었습니다.");
    } catch (err) {
      console.error(err);
      alert("수정에 실패했습니다.");
    }
  };
  
  const handleCancelClick = () => {
    setIsEditing(false);
  };

  const handlePaymentEditClick = () => {
    setEditPayments(JSON.parse(JSON.stringify(payments)));
    setEditAccounts(JSON.parse(JSON.stringify(teamAccounts)));
    setIsPaymentEditing(true);
  };

  const handlePaymentCancelClick = () => {
    setIsPaymentEditing(false);
  };

  const handlePaymentSaveClick = async () => {
    try {
      for (const p of editPayments) {
        await api.post('/payment/update', p);
      }
      for (const a of editAccounts) {
        await api.post('/teamAccount/update', a);
      }
      setPayments(editPayments);
      setTeamAccounts(editAccounts);
      setIsPaymentEditing(false);
      alert("입금 안내가 수정되었습니다.");
    } catch (err) {
      console.error(err);
      alert("수정에 실패했습니다.");
    }
  };

  const updateEditPayment = (idx: number, field: string, value: any) => {
    const newArr = [...editPayments];
    newArr[idx] = { ...newArr[idx], [field]: value };
    setEditPayments(newArr);
  };

  const updateEditAccount = (seq: number, field: string, value: any) => {
    const newArr = [...editAccounts];
    const idx = newArr.findIndex(a => a.team_account_seq === seq);
    if (idx !== -1) {
      newArr[idx] = { ...newArr[idx], [field]: value };
      setEditAccounts(newArr);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr || timeStr.length !== 4) return timeStr || '';
    return `${timeStr.substring(0,2)}:${timeStr.substring(2,4)}`;
  };
  
  // 헬퍼: 코드로 이름 찾기 (level_cd면 reference_1 우선 사용)
  const getCodeName = (group: string, codeVal?: string, useRef1?: boolean) => {
    if (!codeVal) return '';
    const item = codeLists[group]?.find(c => c.code === codeVal);
    if (!item) return codeVal;
  

  return (useRef1 && item.reference_1) ? item.reference_1 : item.code_name;
  };



  const updateMemberStatus = async (memberUid: string, newStatusCd: string) => {
    try {
      await api.post('/team_member/update', {
        team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
        member_uid: memberUid,
        status_cd: newStatusCd
      });
      setTeamMembers(prev => prev.map(m => m.member_uid === memberUid ? { ...m, status_cd: newStatusCd } : m));
    } catch (err) {
      console.error(err);
      alert('상태 변경에 실패했습니다.');
    }
  };


  const handleStartEditScores = (memberUid: string) => {
    const scoresForMember = memberScores.filter(s => s.member_uid === memberUid);
    const scoreMap: Record<string, number> = {};
    
    SCORE_CATEGORIES.forEach(cat => {
      cat.codes.forEach(code => {
        const found = scoresForMember.find(s => s.score_cd === code);
        scoreMap[code] = found ? parseInt(found.score_val, 10) || 13 : 13;
      });
    });

    setEditingScores(scoreMap);
    setEditingMemberUid(memberUid);
  };

  const handleCancelEditScores = () => {
    setEditingMemberUid(null);
    setEditingScores({});
  };

  const handleScoreFieldChange = (scoreCd: string, val: string) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 20) num = 20;
    setEditingScores(prev => ({
      ...prev,
      [scoreCd]: num
    }));
  };

  const handleSaveScores = async () => {
    if (!editingMemberUid || isSavingScores) return;
    setIsSavingScores(true);

    try {
      const promises = Object.entries(editingScores).map(async ([scoreCd, val]) => {
        try {
          await api.post('/memberScore/update', {
            team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
            member_uid: editingMemberUid,
            year: '2026',
            score_cd: scoreCd,
            score_val: val.toString()
          });
        } catch (err: any) {
          if (err.response?.status === 404) {
            await api.post('/memberScore/insert', {
              team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
              member_uid: editingMemberUid,
              year: '2026',
              score_cd: scoreCd,
              score_val: val.toString()
            });
          }
        }
      });

      await Promise.all(promises);

      // 로컬 memberScores 업데이트
      setMemberScores(prev => {
        const withoutMember = prev.filter(s => s.member_uid !== editingMemberUid);
        const updatedList = Object.entries(editingScores).map(([score_cd, val]) => ({
          member_uid: editingMemberUid!,
          score_cd,
          score_val: val.toString()
        }));
        return [...withoutMember, ...updatedList];
      });

      alert('선수 능력치가 성공적으로 저장되었습니다.');
      setEditingMemberUid(null);
      setEditingScores({});
    } catch (e) {
      console.error(e);
      alert('능력치 저장에 실패했습니다.');
    } finally {
      setIsSavingScores(false);
    }
  };

  return (
    <div style={{ padding: '0px', backgroundColor: '#f9f9f9', minHeight: '100vh', paddingBottom: editingMemberUid ? '140px' : '70px' }}>
      
      {/* Sub Tab Navigation (Toss Pill-shaped Segmented Control) */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#fff',
        padding: '12px 20px',
        borderBottom: '1px solid #f2f4f6',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          backgroundColor: '#f2f4f6',
          borderRadius: '24px',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            onClick={() => setSubTab('INFO')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: subTab === 'INFO' ? '#fff' : 'transparent',
              color: subTab === 'INFO' ? '#191f28' : '#8b95a1',
              fontWeight: subTab === 'INFO' ? '700' : '500',
              fontSize: 'calc(14px * var(--scale-factor, 1))',
              boxShadow: subTab === 'INFO' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            팀관리
          </button>
          <button
            onClick={() => setSubTab('SQUAD')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: subTab === 'SQUAD' ? '#fff' : 'transparent',
              color: subTab === 'SQUAD' ? '#191f28' : '#8b95a1',
              fontWeight: subTab === 'SQUAD' ? '700' : '500',
              fontSize: 'calc(14px * var(--scale-factor, 1))',
              boxShadow: subTab === 'SQUAD' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            선수단
          </button>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {subTab === 'INFO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Team Info Card */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>⚽ 팀 정보</h3>
                {!isEditing ? (
                  <button onClick={handleEditClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    수정
                  </button>
                ) : (
                  <div>
                    <button onClick={handleCancelClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' }}>
                      취소
                    </button>
                    <button onClick={handleSaveClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      저장
                    </button>
                  </div>
                )}
              </div>
              
              {teamInfo ? (
                isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>팀명</span>
                      <input type="text" value={editForm.teamname || ''} onChange={e => setEditForm({...editForm, teamname: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>지역</span>
                      <select value={editForm.region_cd || ''} onChange={e => setEditForm({...editForm, region_cd: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                        <option value="">선택</option>
                        {codeLists.region_cd?.map(c => (
                          <option key={c.code} value={c.code}>{c.code_name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>활동요일</span>
                      <select value={editForm.day_cd || ''} onChange={e => setEditForm({...editForm, day_cd: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                        <option value="">선택</option>
                        {codeLists.day_cd?.map(c => (
                          <option key={c.code} value={c.code}>{c.code_name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>주구장</span>
                      <input type="text" value={editForm.location || ''} onChange={e => setEditForm({...editForm, location: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>시작시간</span>
                      <input type="text" value={editForm.start_time || ''} onChange={e => setEditForm({...editForm, start_time: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="HHMM" />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>종료시간</span>
                      <input type="text" value={editForm.end_time || ''} onChange={e => setEditForm({...editForm, end_time: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="HHMM" />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '70px' }}>실력</span>
                      <select value={editForm.level_cd || ''} onChange={e => setEditForm({...editForm, level_cd: e.target.value})} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                        <option value="">선택</option>
                        {codeLists.level_cd?.map(c => (
                          <option key={c.code} value={c.code}>{c.code_name} {c.reference_1 ? `(${c.reference_1})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#888', marginBottom: '5px' }}>코멘트</span>
                      <textarea value={editForm.comment || ''} onChange={e => setEditForm({...editForm, comment: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#555' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>팀명</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.teamname}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>지역</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{getCodeName('region_cd', teamInfo.region_cd)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>활동요일</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{getCodeName('day_cd', teamInfo.day_cd)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>주구장</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.location}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>운동 시간</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>
                        {formatTime(teamInfo.start_time)} ~ {formatTime(teamInfo.end_time)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>실력</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{getCodeName('level_cd', teamInfo.level_cd, true)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#888' }}>회원 수</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.member_count}명</span>
                    </div>
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f4f4f4', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                      "{teamInfo.comment}"
                    </div>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>팀 정보를 불러오는 중입니다...</div>
              )}
            </div>

            {/* Account Info Card (Dynamic) */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>💸 입금 안내</h3>
                {!isPaymentEditing ? (
                  <button onClick={handlePaymentEditClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    수정
                  </button>
                ) : (
                  <div>
                    <button onClick={handlePaymentCancelClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' }}>
                      취소
                    </button>
                    <button onClick={handlePaymentSaveClick} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      저장
                    </button>
                  </div>
                )}
              </div>
              
              {!isPaymentEditing ? (
                payments.length > 0 ? (
                  payments.map(payment => {
                    const account = teamAccounts.find(a => a.team_account_seq === payment.team_account_seq);
                    const bankName = getCodeName('bank_cd', account?.bank_cd) || account?.bank_cd || '알 수 없음';
                    const paymentName = getCodeName('payment_cd', payment.payment_cd) || (payment.payment_cd === '01' ? '월회비' : '지각비');
                    
                    // 스타일 구분 (월회비는 파란색, 그 외(지각비 등)는 빨간색)
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
                              <span style={{ fontSize: '12px', color: '#888' }}>
                                예금주: {isMonthly ? '이진범' : '강승지'}
                              </span>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(account.account_enc)}
                              style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              복사
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '20px 0' }}>
                    등록된 입금 안내가 없습니다.
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {editPayments.map((payment, idx) => {
                    const account = editAccounts.find(a => a.team_account_seq === payment.team_account_seq);
                    
                  

  return (
                      <div key={idx} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>종류</span>
                          <select value={payment.payment_cd} onChange={e => updateEditPayment(idx, 'payment_cd', e.target.value)} style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {codeLists.payment_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>금액</span>
                          <input type="number" value={Number(payment.amount).toString()} onChange={e => updateEditPayment(idx, 'amount', Number(e.target.value))} style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        </div>
                        {account && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>은행</span>
                              <select value={account.bank_cd} onChange={e => updateEditAccount(account.team_account_seq, 'bank_cd', e.target.value)} style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                {codeLists.bank_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                              </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>계좌</span>
                              <input type="text" value={account.account_enc} onChange={e => updateEditAccount(account.team_account_seq, 'account_enc', e.target.value)} style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'SQUAD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#191f28', margin: '0 0 4px 0' }}>🏃 선수단 명단</h3>
                  <p style={{ fontSize: '13px', color: '#8b95a1', margin: 0 }}>선수를 탭하면 4개 카테고리 능력치를 확인하고 수정할 수 있습니다.</p>
                </div>
                <span style={{ backgroundColor: '#f2f4f6', padding: '6px 12px', borderRadius: '14px', fontSize: '13px', fontWeight: 'bold', color: '#4e5968' }}>
                  총 {teamMembers.length}명
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {teamMembers.map(member => {
                  const isExpanded = expandedMemberUid === member.member_uid;
                  const isEditingThisMember = editingMemberUid === member.member_uid;
                  const memberScoreList = memberScores.filter(s => s.member_uid === member.member_uid);
                  
                  // 선수 평균 점수 계산
                  const avgScore = (() => {
                    if (memberScoreList.length === 0) return '13.0';
                    const sum = memberScoreList.reduce((acc, curr) => acc + (parseFloat(curr.score_val) || 0), 0);
                    return (sum / memberScoreList.length).toFixed(1);
                  })();

                  let bgColor = '#e6f4ea';
                  let color = '#137333';
                  if (member.status_cd === '02') { bgColor = '#fce8e6'; color = '#c5221f'; }
                  else if (member.status_cd === '03') { bgColor = '#f1f3f4'; color = '#5f6368'; }

                  return (
                    <div 
                      key={member.member_uid} 
                      style={{ 
                        border: isExpanded ? '1.5px solid var(--toss-blue)' : '1px solid #f2f4f6', 
                        borderRadius: '16px', 
                        backgroundColor: '#fff',
                        boxShadow: isExpanded ? '0 4px 16px rgba(49, 130, 246, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                        overflow: 'hidden',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {/* Member Card Header */}
                      <div 
                        onClick={() => {
                          if (editingMemberUid && editingMemberUid !== member.member_uid) {
                            if (!window.confirm("편집 중인 내용이 저장되지 않았습니다. 다른 선수로 이동하시겠습니까?")) return;
                            handleCancelEditScores();
                          }
                          setExpandedMemberUid(isExpanded ? null : member.member_uid);
                        }}
                        style={{ 
                          padding: '16px', 
                          backgroundColor: isExpanded ? '#fbfcfe' : '#fff', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#191f28' }}>{member.member_name}</span>
                          {member.user_id && (
                            <span style={{ backgroundColor: '#FEE500', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>K</span>
                          )}
                          <span style={{ 
                            backgroundColor: bgColor, color: color, 
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' 
                          }}>
                            {getCodeName('status_cd', member.status_cd) || '상태 없음'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isAdmin && (
                            <select 
                              onClick={(e) => e.stopPropagation()}
                              value={member.status_cd || '01'}
                              onChange={(e) => updateMemberStatus(member.member_uid, e.target.value)}
                              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff' }}
                            >
                              {codeLists.status_cd?.map(c => <option key={c.code} value={c.code}>{c.code_name}</option>)}
                            </select>
                          )}
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: isExpanded ? 'var(--toss-blue)' : '#8b95a1',
                            backgroundColor: isExpanded ? 'var(--toss-light-blue)' : '#f2f4f6',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            transition: 'all 0.2s'
                          }}>
                            {isExpanded ? '스탯 접기 ▴' : '스탯 보기 ▾'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Expanded Stats Section */}
                      {isExpanded && (
                        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderTop: '1px solid #f2f4f6' }}>
                          {/* Stats Header Bar */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f2f4f6' }}>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#191f28' }}>능력치 리포트</span>
                              <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--toss-blue)', fontWeight: 'bold', backgroundColor: 'var(--toss-light-blue)', padding: '2px 8px', borderRadius: '8px' }}>
                                ⭐ 평균 {avgScore}점
                              </span>
                            </div>
                            {isAdmin && (
                              <div>
                                {!isEditingThisMember ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditScores(member.member_uid);
                                    }}
                                    className="vote-action-btn"
                                    style={{
                                      padding: '6px 14px',
                                      backgroundColor: 'var(--toss-light-blue)',
                                      color: 'var(--toss-blue)',
                                      borderRadius: '8px',
                                      fontSize: '12px'
                                    }}
                                  >
                                    수정하기 ✏️
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--toss-blue)', fontWeight: 'bold', animation: 'fadeIn 0.2s' }}>
                                    ✍️ 편집 중 (0~20점)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Grouped Stats Categories */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {SCORE_CATEGORIES.map(category => {
                              // 카테고리 평균 점수 계산
                              const catScores = category.codes.map(code => {
                                const found = memberScoreList.find(s => s.score_cd === code);
                                return isEditingThisMember ? (editingScores[code] ?? 13) : (found ? parseInt(found.score_val, 10) : 13);
                              });
                              const catAvg = (catScores.reduce((a, b) => a + b, 0) / catScores.length).toFixed(1);

                              return (
                                <div 
                                  key={category.id} 
                                  style={{ 
                                    backgroundColor: '#f9fafb', 
                                    borderRadius: '12px', 
                                    padding: '12px 14px',
                                    border: '1px solid #f2f4f6'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '14px' }}>{category.icon}</span>
                                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333d4b' }}>{category.title}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: category.color, backgroundColor: category.bgColor, padding: '2px 8px', borderRadius: '10px' }}>
                                      평균 {catAvg}
                                    </span>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                    {category.codes.map(code => {
                                      const codeObj = codeLists.score_cd?.find(c => c.code === code);
                                      const codeName = codeObj?.code_name || code;
                                      const existing = memberScoreList.find(s => s.score_cd === code);
                                      const scoreVal = isEditingThisMember ? (editingScores[code] ?? 13) : (existing ? parseInt(existing.score_val, 10) : 13);

                                      return (
                                        <div 
                                          key={code}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: '#fff',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: isEditingThisMember ? '1px solid #d0d7de' : '1px solid #f2f4f6',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                          }}
                                        >
                                          <span style={{ fontSize: '12px', color: '#4e5968', fontWeight: 500 }}>
                                            {codeName}
                                          </span>

                                          {isEditingThisMember ? (
                                            <input 
                                              type="number"
                                              min="0"
                                              max="20"
                                              value={editingScores[code] ?? 13}
                                              onChange={(e) => handleScoreFieldChange(code, e.target.value)}
                                              style={{
                                                width: '46px',
                                                textAlign: 'center',
                                                padding: '4px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--toss-blue)',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                color: '#191f28',
                                                backgroundColor: '#f8faff',
                                                outline: 'none'
                                              }}
                                            />
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: '32px', height: '4px', backgroundColor: '#eef0f2', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                  width: `${Math.min(100, (scoreVal / 20) * 100)}%`, 
                                                  height: '100%', 
                                                  backgroundColor: scoreVal >= 15 ? 'var(--toss-blue)' : scoreVal >= 10 ? 'var(--toss-green)' : 'var(--toss-orange)',
                                                  borderRadius: '2px'
                                                }} />
                                              </div>
                                              <span style={{
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                color: scoreVal >= 15 ? 'var(--toss-blue)' : scoreVal >= 10 ? '#191f28' : '#8b95a1',
                                                minWidth: '18px',
                                                textAlign: 'right'
                                              }}>
                                                {scoreVal}
                                              </span>
                                            </div>
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
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar for Editing Scores */}
      {editingMemberUid && (
        <div style={{
          position: 'fixed',
          bottom: '50px', // Just above App's Footer Dock
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '1200px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
          borderTop: '1px solid #f2f4f6',
          padding: '12px 20px',
          display: 'flex',
          gap: '12px',
          zIndex: 1050,
          boxSizing: 'border-box'
        }}>
          <button
            onClick={handleCancelEditScores}
            disabled={isSavingScores}
            className="vote-action-btn"
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: '#f2f4f6',
              color: '#4e5968',
              fontSize: '15px'
            }}
          >
            취소
          </button>
          <button
            onClick={handleSaveScores}
            disabled={isSavingScores}
            className="vote-action-btn"
            style={{
              flex: 2,
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: 'var(--toss-blue)',
              color: '#fff',
              fontSize: '15px'
            }}
          >
            {isSavingScores ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}
    </div>
  );
}
