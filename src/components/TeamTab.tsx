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

export default function TeamTab() {
  const [subTab, setSubTab] = useState<'INFO' | 'SQUAD'>('INFO');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);

  useEffect(() => {
    // Fetch team info when tab is INFO
    if (subTab === 'INFO' && !teamInfo) {
      api.get('/teamInfo/search?use_yn=Y')
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setTeamInfo(res.data[0]); // assuming the first active team is Putgochu FC
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

            {/* Account Info Card */}
            <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>💸 입금 안내</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', color: '#3182f6', marginBottom: '5px' }}>월회비 안내</div>
                <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                  월 10,000원<br />(상/하반기 일시납 각 6만원)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f4f4', padding: '10px 15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', color: '#333' }}>
                    <strong>신한은행</strong> 110300644160<br />
                    <span style={{ fontSize: '12px', color: '#888' }}>예금주: 이진범</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard('110300644160')}
                    style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    복사
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#f04452', marginBottom: '5px' }}>지각비 안내</div>
                <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                  지각 시 5,000원
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f4f4', padding: '10px 15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', color: '#333' }}>
                    <strong>카카오뱅크</strong> 79422560871<br />
                    <span style={{ fontSize: '12px', color: '#888' }}>예금주: 강승지</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard('79422560871')}
                    style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#f04452', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    복사
                  </button>
                </div>
              </div>

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
