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

export default function TeamTab() {
  const [subTab, setSubTab] = useState<'INFO' | 'SQUAD'>('INFO');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // 공통 코드 원본 배열 저장 (Select 박스용)
  const [codeLists, setCodeLists] = useState<Record<string, CommonCd[]>>({
    bank_cd: [],
    payment_cd: [],
    region_cd: [],
    level_cd: [],
    day_cd: [],
    gender_cd: []
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
      const groupCds = ['bank_cd', 'payment_cd', 'region_cd', 'level_cd', 'day_cd', 'gender_cd'];
      
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
              })
              .catch(() => {
                team.member_count = 0;
                setTeamInfo(team);
              });
            
            // 4. 계좌 정보 및 결제 가져오기
            api.get(`/teamAccount/search?team_uid=${team.team_uid}`).then(r => setTeamAccounts(r.data)).catch(console.error);
            api.get(`/payment/search?team_uid=${team.team_uid}`).then(r => setPayments(r.data)).catch(console.error);
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

  return (
    <div style={{ padding: '0px', backgroundColor: '#f9f9f9', minHeight: '100vh', paddingBottom: '70px' }}>
      
      {/* Sub Tab Navigation */}
      <div style={{ display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #ddd', position: 'sticky', top: '50px', zIndex: 10 }}>
        <button
          onClick={() => setSubTab('INFO')}
          style={{
            flex: 1, padding: '15px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
            fontWeight: subTab === 'INFO' ? 'bold' : 'normal',
            borderBottom: subTab === 'INFO' ? '3px solid #3182f6' : '3px solid transparent',
            color: subTab === 'INFO' ? '#3182f6' : '#888'
          }}
        >
          팀관리
        </button>
        <button
          onClick={() => setSubTab('SQUAD')}
          style={{
            flex: 1, padding: '15px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
            fontWeight: subTab === 'SQUAD' ? 'bold' : 'normal',
            borderBottom: subTab === 'SQUAD' ? '3px solid #3182f6' : '3px solid transparent',
            color: subTab === 'SQUAD' ? '#3182f6' : '#888'
          }}
        >
          선수단
        </button>
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
                          <input type="number" value={payment.amount} onChange={e => updateEditPayment(idx, 'amount', Number(e.target.value))} style={{ flex: 1, marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
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
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>선수단 명단</h3>
            <p>선수단 리스트가 여기에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
