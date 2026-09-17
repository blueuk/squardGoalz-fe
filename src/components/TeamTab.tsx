import { useEffect, useState } from 'react';
import api from '../api';

interface TeamInfo {
  team_uid: string;
  team_nm: string;
  location: string;
  play_location: string;
  play_time: string;
  skill_level: string;
  comment: string;
  member_count: number;
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
  code_cd: string;
  code_nm: string;
}

export default function TeamTab() {
  const [subTab, setSubTab] = useState<'INFO' | 'SQUAD'>('INFO');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankCodes, setBankCodes] = useState<Record<string, string>>({});
  const [paymentCodes, setPaymentCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (subTab === 'INFO' && !teamInfo) {
      // 1. 팀 정보 가져오기
      api.get('/team_info/search?use_yn=Y')
        .then((res) => {
          if (res.data && res.data.length > 0) {
            const team = res.data[0];
            setTeamInfo(team);
            
            // 2. 해당 팀의 계좌 정보 및 결제 설정 가져오기
            api.get(`/teamAccount/search?team_uid=${team.team_uid}`).then(r => setTeamAccounts(r.data)).catch(console.error);
            api.get(`/payment/search?team_uid=${team.team_uid}`).then(r => setPayments(r.data)).catch(console.error);
          }
        })
        .catch((err) => {
          console.error("팀 정보를 불러오는데 실패했습니다.", err);
        });

      // 3. 공통 코드(은행코드, 결제종류코드) 가져오기
      api.get('/common_cd/search?group_cd=BANK_CD')
        .then(res => {
          const mapping: Record<string, string> = {};
          res.data.forEach((item: CommonCd) => mapping[item.code_cd] = item.code_nm);
          setBankCodes(mapping);
        }).catch(console.error);
        
      api.get('/common_cd/search?group_cd=PAYMENT_CD')
        .then(res => {
          const mapping: Record<string, string> = {};
          res.data.forEach((item: CommonCd) => mapping[item.code_cd] = item.code_nm);
          setPaymentCodes(mapping);
        }).catch(console.error);
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
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>⚽ 팀 정보</h3>
              {teamInfo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#555' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>팀명</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.team_nm}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>지역</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.location}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>주구장</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.play_location}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>운동 시간</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.play_time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>실력</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.skill_level}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>회원 수</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{teamInfo.member_count}명</span>
                  </div>
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f4f4f4', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                    "{teamInfo.comment}"
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>팀 정보를 불러오는 중입니다...</div>
              )}
            </div>

            {/* Account Info Card (Dynamic) */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>💸 입금 안내</h3>
              
              {payments.length > 0 ? (
                payments.map(payment => {
                  const account = teamAccounts.find(a => a.team_account_seq === payment.team_account_seq);
                  const bankName = account ? (bankCodes[account.bank_cd] || account.bank_cd) : '알 수 없음';
                  const paymentName = paymentCodes[payment.payment_cd] || (payment.payment_cd === '01' ? '월회비' : '지각비');
                  
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
