import { useEffect, useState, type ReactNode } from 'react';
import api from './api';
import teamLogo from './img/teamlogo.png';
import letterLogo from './img/letterLogo.png';
import footerHome from './img/footerHome.png';
import footerVideo from './img/footerVideo.png';
import footerSchedule from './img/footerSchedule.png';
import footerTeam from './img/footerTeam.png';
import footerMy from './img/footerMy.png';
import './App.css';
import CalendarTab from './components/CalendarTab';
import TeamTab, { PositionLabels } from './components/TeamTab';
import SoccerBallLoader from './components/SoccerBallLoader';
import RadarChart from './components/RadarChart';
import HomeMatchCard from './components/HomeMatchCard';
import { PermissionProvider } from './permissions';
import { calculateRadarScores, DEFAULT_POSITION_WEIGHTS, buildWeightsFromRows, getCachedPositionWeights, setCachedPositionWeights } from './components/positionUtils';

interface User {
  userid: string;
  nickname: string;
  username?: string;
  phone?: string;
  auth_cd?: string;
}

interface Rate {
  team_uid: string;
  member_uid?: string;
  user_id?: string;
  member_name: string;
  attend_count: number;
  total_matches: number;
  attend_rate: number;
  absent_count: number;
  no_vote_count: number;
  rank_num: number;
  status_cd?: string;
  code_name?: string;
}

// 참석 현황에서 텍스트 대신 아이콘으로 보여줄 선수 상태 (없는 상태는 [상태명] 텍스트로 표시)
const STATUS_ICONS: Record<string, ReactNode> = {
  '육아': '🍼',
  '부상': <span style={{ color: '#e5323b', fontWeight: 900 }}>✚</span>,
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Rate[]>([]);
  const [myAttendCount, setMyAttendCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'HOME' | 'VIDEO' | 'SCHEDULE' | 'TEAM' | 'MY'>('HOME');
  const ITEMS_PER_PAGE = 5;

  // 롤링(슬라이드) 상태 관리
  const [isRollingPlaying, setIsRollingPlaying] = useState(true);
  const [currentRollingIdx, setCurrentRollingIdx] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // MY 탭 스탯 및 가중치 상태
  const [myMemberScores, setMyMemberScores] = useState<any[]>([]);
  const [myPositionWeights, setMyPositionWeights] = useState<Record<string, Record<string, number>>>(
    () => getCachedPositionWeights() || DEFAULT_POSITION_WEIGHTS
  );
  const [myScoresLoading, setMyScoresLoading] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isRollingPlaying && rates.length > 0 && activeTab === 'HOME') {
      interval = setInterval(() => {
        setIsFading(true);
        setTimeout(() => {
          setCurrentRollingIdx((prev) => {
            const totalPages = Math.ceil(rates.length / ITEMS_PER_PAGE);
            return (prev + 1) % totalPages;
          });
          setIsFading(false);
        }, 300);
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRollingPlaying, rates, activeTab]);

  const prevRollingPage = () => {
    setIsFading(true);
    setTimeout(() => {
      const totalPages = Math.ceil(rates.length / ITEMS_PER_PAGE);
      setCurrentRollingIdx((prev) => (prev - 1 + totalPages) % totalPages);
      setIsFading(false);
    }, 300);
  };

  const nextRollingPage = () => {
    setIsFading(true);
    setTimeout(() => {
      const totalPages = Math.ceil(rates.length / ITEMS_PER_PAGE);
      setCurrentRollingIdx((prev) => (prev + 1) % totalPages);
      setIsFading(false);
    }, 300);
  };

  const toggleRolling = () => {
    setIsRollingPlaying(!isRollingPlaying);
  };

  // 화면이 렌더링될 때 세션이 있는지 확인합니다.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await api.get('/kakao/session');
        if (res.data && res.data.userid) {
          const sessionUser = res.data;
          
          try {
            const userRes = await api.get('/user/get', { params: { userid: sessionUser.userid } });
            if (userRes.data && userRes.data.length > 0) {
              setUser({
                ...sessionUser,
                username: userRes.data[0].username,
                phone: userRes.data[0].phone,
                auth_cd: userRes.data[0].auth_cd
              });
            } else {
              setUser(sessionUser);
            }
          } catch (e) {
            setUser(sessionUser);
          }
        }
      } catch (error) {
        // 세션 없으면 무시
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // user가 세팅되면 풋고추FC 전체 참석률 조회
  useEffect(() => {
    if (user) {
      fetchRates();
    }
  }, [user]);

  // MY 탭 진입 시 현재 로그인한 유저의 올해 참석 횟수 및 스탯 조회
  useEffect(() => {
    if (activeTab === 'MY' && user && rates.length > 0) {
      fetchMyRate();
    }
  }, [activeTab, user, rates]);

  const fetchRates = async () => {
    try {
      const res = await api.get('/rate/search', {
        params: {
          team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
          year: '2026',
        }
      });
      setRates(res.data);
    } catch (error) {
      console.error("참석률 조회 실패:", error);
    }
  };

  const fetchMyRate = async () => {
    const myInfo = rates.find(r => 
      (r.user_id && r.user_id === user?.userid) || 
      (r.member_name === user?.username)
    );
    if (!myInfo?.member_uid) return;

    try {
      setMyScoresLoading(true);
      const currentYear = new Date().getFullYear().toString();
      const cachedWeights = getCachedPositionWeights();

      // 병렬 요청으로 불필요한 직렬 대기 방지
      const [rateRes, scoreRes, weightRes] = await Promise.all([
        api.get('/rate/search', {
          params: {
            team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
            member_uid: myInfo.member_uid,
            year: currentYear
          }
        }),
        api.get('/memberScore/search', {
          params: {
            team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
            member_uid: myInfo.member_uid
          }
        }),
        cachedWeights ? Promise.resolve(null) : api.get('/position_point/search')
      ]);

      if (rateRes?.data && rateRes.data.length > 0) {
        setMyAttendCount(rateRes.data[0].attend_count);
      }

      setMyMemberScores(scoreRes?.data || []);

      if (cachedWeights) {
        setMyPositionWeights(cachedWeights);
      } else if (weightRes?.data && weightRes.data.length > 0) {
        const loaded = buildWeightsFromRows(weightRes.data);
        setCachedPositionWeights(loaded);
        setMyPositionWeights(loaded);
      }
    } catch (error) {
      console.error("내 데이터 조회 실패:", error);
    } finally {
      setMyScoresLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    window.location.href = '/kakao/login';
  };

  const handleLogout = async () => {
    await api.post('/kakao/logout');
    setUser(null);
    setRates([]);
  };

  const queryParams = new URLSearchParams(window.location.search);
  const isRegister = window.location.pathname === '/register';
  const registerUserId = queryParams.get('userid');
  const registerNickname = queryParams.get('nickname');

  // 내 상태 변경 관리를 위한 상태
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatusCd, setSelectedStatusCd] = useState<string>('01');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const myInfo = rates.find(r => (r.user_id && r.user_id === user?.userid) || (r.member_name === user?.username));

  // 유튜브 관련 상태
  const [videos, setVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState(false);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        // 백엔드가 유튜브 채널 RSS를 대신 읽어 전달 (브라우저에서 직접 읽으면 CORS로 막힘)
        const res = await api.get('/youtube/latest');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setVideos(res.data);
        } else {
          setVideosError(true);
        }
      } catch (e) {
        setVideosError(true);
      } finally {
        setVideosLoading(false);
      }
    };
    fetchVideos();
  }, []);

  const handleStatusChange = async () => {
    if (!myInfo?.member_uid) return;
    setStatusUpdating(true);
    try {
      await api.post('/team_member/update', {
        team_uid: myInfo.team_uid,
        member_uid: myInfo.member_uid,
        status_cd: selectedStatusCd
      });
      alert('상태가 성공적으로 변경되었습니다.');
      setEditingStatus(false);
      fetchRates();
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await api.post('/login/register', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      alert('회원가입이 완료되었습니다!');
      window.location.href = '/';
    } catch (error) {
      alert('회원가입 중 오류가 발생했습니다.');
    }
  };

  // 로딩 모션 (축구공 좌우 롤링)
  if (loading) return <SoccerBallLoader message="풋고추FC 로딩 중..." />;

  if (isRegister) {
    return (
      <div className="register-page">
        <div className="register-card">
          <h2 className="register-title">⚽ 풋고추FC 회원가입</h2>
          <p className="register-desc">서비스 이용을 위해 추가 정보를 입력해주세요.</p>
          <form className="register-form" onSubmit={handleRegister}>
            <input type="hidden" name="userid" value={registerUserId || ''} />
            <label className="register-field">
              <span>이름(실명)</span>
              <input type="text" name="username" autoComplete="name" required />
            </label>
            <label className="register-field">
              <span>닉네임</span>
              <input type="text" name="nickname" autoComplete="nickname" defaultValue={registerNickname || ''} required />
            </label>
            <label className="register-field">
              <span>전화번호</span>
              <input type="tel" name="phone" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" required />
            </label>
            <button type="submit" className="register-submit">가입 완료하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <PermissionProvider userid={user?.userid}>
    <div className="app-container">
      {statusUpdating && <SoccerBallLoader message="상태를 변경하는 중입니다..." />}

      {!user ? (
        <div style={{ textAlign: 'center', marginTop: '100px', padding: '20px' }}>
          <img 
            src={teamLogo} 
            alt="Squard Goalz Logo" 
            style={{ width: '250px', height: 'auto', marginBottom: '10px' }} 
          />
          <p>서비스를 이용하시려면 카카오 로그인이 필요합니다.</p>
          <button 
            onClick={handleKakaoLogin}
            style={{
              backgroundColor: '#FEE500', 
              color: '#000000', 
              border: 'none', 
              padding: '15px 30px', 
              fontSize: 'calc(18px * var(--scale-factor, 1))', 
              fontWeight: 'bold', 
              borderRadius: '8px', 
              cursor: 'pointer',
              marginTop: '20px'
            }}>
            카카오로 시작하기
          </button>
        </div>
      ) : (
        <>
          {/* Top Bar */}
          <header style={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%',
            maxWidth: '1200px',
            height: '50px', 
            padding: '0 15px', 
            borderBottom: '1px solid #ddd',
            backgroundColor: '#fff',
            gap: '8px',
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}>
            <img src={letterLogo} alt="Team Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontWeight: 'bold', fontSize: 'calc(15px * var(--scale-factor, 1))' }}>풋고추FC</span>
          </header>
          
          {/* Main Content */}
          <main style={{ paddingTop: '60px', paddingBottom: '70px', paddingLeft: '20px', paddingRight: '20px', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
            {activeTab === 'HOME' && (
              <div id="home" className="section" style={{ display: 'block' }}>
                <div id="rate-card" className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="card-title" style={{ margin: 0 }}>멤버 참석 현황</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f2f4f6', padding: '2px 8px', borderRadius: '12px' }}>
                      <button onClick={prevRollingPage} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#191f28', padding: '4px 6px', fontWeight: 'bold', outline: 'none' }}>&lt;</button>
                      <button id="rolling-toggle-btn" onClick={toggleRolling} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#191f28', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 4px', fontWeight: 'bold', outline: 'none' }}>
                        {isRollingPlaying ? '⏸\uFE0E' : '▶\uFE0E'}
                      </button>
                      <button onClick={nextRollingPage} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#191f28', padding: '4px 6px', fontWeight: 'bold', outline: 'none' }}>&gt;</button>
                    </div>
                  </div>
                  <div id="rolling-content" className="card-value" style={{ transition: 'opacity 0.3s ease-in-out', opacity: isFading ? 0 : 1 }}>
                    {rates.length > 0 ? (
                      rates
                        .sort((a, b) => a.rank_num - b.rank_num)
                        .slice(currentRollingIdx * ITEMS_PER_PAGE, (currentRollingIdx + 1) * ITEMS_PER_PAGE)
                        .map((rate, index) => {
                          const crown = rate.rank_num === 1 ? <span className="crown">👑</span> : null;
                          return (
                            <div key={index} className="rank-item">
                                <div className="rank-info" style={{ flexShrink: 1, minWidth: 0, overflow: 'hidden', marginRight: '4px' }}>
                                    <span className="rank-num" style={{ fontSize: 'calc(min(15px, 3.8vw) * var(--scale-factor, 1))' }}>{rate.rank_num}위</span>
                                    <span className="rank-name" style={{ fontSize: 'calc(min(15px, 3.8vw) * var(--scale-factor, 1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {rate.member_name}
                                        {rate.status_cd && rate.status_cd !== '01' && rate.code_name && (
                                            STATUS_ICONS[rate.code_name] ? (
                                                <span title={rate.code_name} aria-label={rate.code_name} style={{ fontSize: 'calc(min(14px, 3.5vw) * var(--scale-factor, 1))', marginLeft: '4px' }}>
                                                    {STATUS_ICONS[rate.code_name]}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: 'calc(min(12px, 3vw) * var(--scale-factor, 1))', color: '#dc3545', marginLeft: '4px', fontWeight: 'bold' }}>
                                                    [{rate.code_name}]
                                                </span>
                                            )
                                        )}
                                        {crown}
                                    </span>
                                </div>
                                <div className="rank-stat" style={{ flexShrink: 1, minWidth: 0, textAlign: 'right' }}>
                                    <span style={{ color: 'var(--toss-blue)', fontWeight: 700, fontSize: 'calc(min(14px, 3.5vw) * var(--scale-factor, 1))' }}>{rate.attend_rate.toFixed(1)}%</span>
                                    <span style={{ fontSize: 'calc(min(11px, 2.7vw) * var(--scale-factor, 1))', color: 'var(--toss-gray)', marginLeft: '4px', letterSpacing: '-0.5px' }}>
                                        (참석:{rate.attend_count} 불참:{rate.absent_count} 미투표:{rate.no_vote_count})
                                    </span>
                                </div>
                            </div>
                          );
                        })
                    ) : (
                      <div style={{ color: 'var(--toss-gray)', fontSize: 'calc(14px * var(--scale-factor, 1))', textAlign: 'center', padding: '20px 0' }}>
                        조회된 참석률 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
                
                <HomeMatchCard />
              </div>
            )}

            {activeTab === 'VIDEO' && (
              <div className="section" style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>최신 경기 영상</span>
                    <a href="https://www.youtube.com/@FC_GreeN_PeppeR" target="_blank" rel="noopener noreferrer" style={{ fontSize: 'calc(13px * var(--scale-factor, 1))', color: 'var(--toss-blue)', textDecoration: 'none', fontWeight: 500 }}>
                      채널 가기 &gt;
                    </a>
                  </div>
                  
                  <div className="youtube-slider">
                    {videosLoading ? (
                      <div style={{ width: '100%', textAlign: 'center', color: 'var(--toss-gray)', fontSize: 'calc(14px * var(--scale-factor, 1))', padding: '20px 0' }}>
                        영상을 불러오는 중...
                      </div>
                    ) : videosError || videos.length === 0 ? (
                      <div style={{ width: '100%', textAlign: 'center', color: 'var(--toss-gray)', fontSize: 'calc(13px * var(--scale-factor, 1))', padding: '20px 0' }}>
                        최신 영상을 불러오지 못했습니다.
                      </div>
                    ) : (
                      videos.map((video, idx) => (
                        <a key={idx} className="youtube-slide" href={video.link} target="_blank" rel="noopener noreferrer">
                          <img className="youtube-thumbnail" src={video.thumbnail} alt="썸네일" loading="lazy" />
                          <div className="youtube-title">{video.title}</div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'SCHEDULE' && (
              <CalendarTab teamUid="df743e05-9440-4c1e-bfdb-fa07159ef0c9" members={rates} />
            )}

            {activeTab === 'TEAM' && <TeamTab />}

            {activeTab === 'MY' && user && (
              <div className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* 1. 프로필 요약 */}
                <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                  <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#eee', 
                    margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '32px'
                  }}>
                    👤
                  </div>
                  <h3 style={{ margin: 0 }}>{user.username || '이름 없음'}</h3>
                  <p style={{ margin: '5px 0 0 0', color: '#888' }}>{user.nickname}</p>
                </div>

                {/* 2. 두 번째: 내 능력치 분석 (6각형 레이더 그래프 & 포지션별 라벨+점수) */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#191f28' }}>📊 내 능력치 분석</span>
                  </div>

                  {myScoresLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#8b95a1', fontSize: '13px' }}>
                      능력치를 분석하는 중입니다...
                    </div>
                  ) : myMemberScores.length > 0 ? (
                    <div style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '16px', border: '1px solid #f2f4f6' }}>
                      {/* 6각형 레이더 그래프 */}
                      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                        <RadarChart scores={calculateRadarScores(myMemberScores)} size={220} showValues={true} />
                      </div>

                      {/* 포지션별 라벨 + 점수 */}
                      <div style={{ marginTop: '14px', borderTop: '1px solid #eef0f2', paddingTop: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4e5968', marginBottom: '6px' }}>
                          포지션별 환산 점수 (100점 만점)
                        </div>
                        <PositionLabels memberScoreList={myMemberScores} positionWeights={myPositionWeights} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '15px 0', color: '#8b95a1', fontSize: '13px' }}>
                      등록된 능력치 정보가 없습니다.
                    </div>
                  )}
                </div>

                {/* 3. 세 번째: 회원 상세 정보 */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>ID (카카오)</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{user.userid}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>권한</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{user.auth_cd === '01' ? '관리자' : '일반'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888' }}>내 상태</span>
                    {editingStatus ? (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <select 
                          value={selectedStatusCd} 
                          onChange={(e) => setSelectedStatusCd(e.target.value)}
                          style={{ padding: '2px 5px', borderRadius: '4px', border: '1px solid #ddd' }}
                          disabled={statusUpdating}
                        >
                          <option value="01">활동</option>
                          <option value="02">부상</option>
                          <option value="03">휴식</option>
                        </select>
                        <button 
                          onClick={handleStatusChange} 
                          style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#3182f6', color: '#fff', border: 'none', cursor: 'pointer' }}
                          disabled={statusUpdating}
                        >
                          저장
                        </button>
                        <button 
                          onClick={() => setEditingStatus(false)} 
                          style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f4f4f4', color: '#000', border: '1px solid #ddd', cursor: 'pointer' }}
                          disabled={statusUpdating}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>
                          {myInfo?.code_name || '상태 없음'}
                        </span>
                        <button 
                          onClick={() => {
                            setSelectedStatusCd(myInfo?.status_cd || '01');
                            setEditingStatus(true);
                          }}
                          style={{ padding: '2px 8px', fontSize: 'calc(12px * var(--scale-factor, 1))', borderRadius: '4px', backgroundColor: '#f4f4f4', color: '#000', border: '1px solid #ddd', cursor: 'pointer' }}
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>MemberID</span>
                    {(() => {
                      const uid = myInfo?.member_uid || '-';
                      const displayUid = uid.length > 10 ? uid.substring(0, 10) + '...' : uid;
                      return (
                        <span 
                          style={{ fontWeight: 'bold', color: '#333', cursor: uid.length > 10 ? 'help' : 'default' }}
                          title={uid}
                        >
                          {displayUid}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>전화번호</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{user.phone || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>소속팀</span>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>풋고추FC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>올해 참가경기수</span>
                    <span style={{ fontWeight: 'bold', color: '#3182f6' }}>
                      {myAttendCount}회
                    </span>
                  </div>
                </div>

                {/* 4. 네 번째: 로그아웃 버튼 */}
                <button onClick={handleLogout} className="btn" style={{ 
                  marginTop: '15px', 
                  backgroundColor: '#f8f9fa', 
                  color: '#dc3545',
                  border: '1px solid #ddd'
                }}>
                  로그아웃
                </button>
              </div>
            )}
          </main>

          {/* Bottom Dock */}
          <footer style={{ 
            display: 'flex', 
            justifyContent: 'space-around', 
            alignItems: 'center', 
            width: '100%',
            maxWidth: '1200px',
            height: '50px', 
            borderTop: '1px solid #ddd',
            backgroundColor: '#fff',
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}>
            <button 
              onClick={() => window.location.reload()}
              style={{ 
              flex: 1, height: '100%', border: 'none', backgroundColor: 'transparent', 
              cursor: 'pointer', opacity: activeTab === 'HOME' ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
            }}>
              <img src={footerHome} alt="Home" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              <span style={{ fontSize: 'calc(9px * var(--scale-factor, 1))', fontWeight: activeTab === 'HOME' ? 'bold' : 'normal', color: '#333' }}>홈</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('VIDEO')}
              style={{ 
              flex: 1, height: '100%', border: 'none', backgroundColor: 'transparent', 
              cursor: 'pointer', opacity: activeTab === 'VIDEO' ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
            }}>
              <img src={footerVideo} alt="Video" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              <span style={{ fontSize: 'calc(9px * var(--scale-factor, 1))', fontWeight: activeTab === 'VIDEO' ? 'bold' : 'normal', color: '#333' }}>영상</span>
            </button>

            <button 
              onClick={() => setActiveTab('SCHEDULE')}
              style={{ 
              flex: 1, height: '100%', border: 'none', backgroundColor: 'transparent', 
              cursor: 'pointer', opacity: activeTab === 'SCHEDULE' ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
            }}>
              <img src={footerSchedule} alt="Schedule" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              <span style={{ fontSize: 'calc(9px * var(--scale-factor, 1))', fontWeight: activeTab === 'SCHEDULE' ? 'bold' : 'normal', color: '#333' }}>일정</span>
            </button>

            <button 
              onClick={() => setActiveTab('TEAM')}
              style={{ 
              flex: 1, height: '100%', border: 'none', backgroundColor: 'transparent', 
              cursor: 'pointer', opacity: activeTab === 'TEAM' ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
            }}>
              <img src={footerTeam} alt="Team" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              <span style={{ fontSize: 'calc(9px * var(--scale-factor, 1))', fontWeight: activeTab === 'TEAM' ? 'bold' : 'normal', color: '#333' }}>팀관리</span>
            </button>

            <button 
              onClick={() => setActiveTab('MY')}
              style={{ 
              flex: 1, height: '100%', border: 'none', backgroundColor: 'transparent', 
              cursor: 'pointer', opacity: activeTab === 'MY' ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
            }}>
              <img src={footerMy} alt="MY" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              <span style={{ fontSize: 'calc(9px * var(--scale-factor, 1))', fontWeight: activeTab === 'MY' ? 'bold' : 'normal', color: '#333' }}>MY</span>
            </button>
          </footer>
        </>
      )}
    </div>
    </PermissionProvider>
  );
}

export default App;
