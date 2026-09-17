import { useEffect, useState } from 'react';
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
import TeamTab from './components/TeamTab';

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
        // 백엔드의 세션 체크 엔드포인트 호출
        const res = await api.get('/kakao/session');
        if (res.data && res.data.userid) {
          const sessionUser = res.data;
          
          // 유저 상세 정보 조회 (이름, 전화번호 등)
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
        // 401 등 세션이 없으면 무시 (null 상태 유지)
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // user가 세팅되면 풋고추FC 전체 참석률(HOME 화면용)을 조회합니다.
  useEffect(() => {
    if (user) {
      fetchRates();
    }
  }, [user]);

  // MY 탭 진입 시 현재 로그인한 유저의 올해 참석 횟수를 개별 조회합니다.
  useEffect(() => {
    if (activeTab === 'MY' && user && rates.length > 0) {
      fetchMyRate();
    }
  }, [activeTab, user, rates]);

  const fetchRates = async () => {
    try {
      // 풋고추FC의 2026 참석률 조회
      // rateController의 GET /rate/search API를 호출합니다.
      const res = await api.get('/rate/search', {
        params: {
          team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9', // 풋고추FC 고유 식별자
          year: '2026',
        }
      });
      setRates(res.data);
    } catch (error) {
      console.error("참석률 조회 실패:", error);
    }
  };

  const fetchMyRate = async () => {
    // 홈 화면 용으로 조회된 rates에서 내 member_uid를 찾습니다.
    // 카카오 연동(user_id)이 DB에 비어있을 수 있으므로 실명(member_name)을 Fallback으로 사용합니다.
    const myInfo = rates.find(r => 
      (r.user_id && r.user_id === user?.userid) || 
      (r.member_name === user?.username)
    );
    if (!myInfo?.member_uid) return;

    try {
      const currentYear = new Date().getFullYear().toString();
      const res = await api.get('/rate/search', {
        params: {
          team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
          member_uid: myInfo.member_uid,
          year: currentYear
        }
      });
      if (res.data && res.data.length > 0) {
        setMyAttendCount(res.data[0].attend_count);
      }
    } catch (error) {
      console.error("내 올해 참석률 개별 조회 실패:", error);
    }
  };

  const handleKakaoLogin = () => {
    // 백엔드의 카카오 로그인 라우터로 이동하여 소셜 로그인을 시작합니다.
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

  // 날씨 관련 상태
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const schedRes = await api.get('/schedule/search', { params: { team_uid: 1 } });
        const schedules = schedRes.data || [];
        
        const now = new Date();
        // offset to KST to prevent timezone bug in string comparison
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        const nowStr = kstNow.toISOString().split('T')[0];
        
        let targetSchedule = null;
        let minDiff = Infinity;
        
        for (const s of schedules) {
          if (s.play_date >= nowStr) {
            const diff = new Date(s.play_date).getTime() - new Date(nowStr).getTime();
            if (diff < minDiff) {
              minDiff = diff;
              targetSchedule = s;
            }
          }
        }
        
        let dateStr = '';
        let lat = 37.58;
        let lon = 127.24;
        let locationName = '월문3리 풋살구장';
        let targetTime = 7;
        
        if (targetSchedule) {
          dateStr = targetSchedule.play_date;
          locationName = targetSchedule.play_location || '월문3리 풋살구장';
          if (locationName.includes('다산')) {
            lat = 37.618;
            lon = 127.158;
          }
          
          if (targetSchedule.play_start_time) {
            const parsedTime = parseInt(targetSchedule.play_start_time.split(':')[0], 10);
            if (!isNaN(parsedTime)) targetTime = parsedTime;
          }
        } else {
          const distToSat = (6 - now.getDay() + 7) % 7;
          const satDate = new Date(now.getTime() + distToSat * 24 * 60 * 60 * 1000);
          dateStr = satDate.toISOString().split('T')[0];
        }

        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation,weathercode&timezone=Asia%2FSeoul&start_date=${dateStr}&end_date=${dateStr}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        setWeatherData({ hourly: data.hourly, dateStr, locationName, targetTime });
      } catch (e) {
        console.error(e);
        setWeatherError(true);
      }
    };
    fetchWeather();
  }, []);

  // 유튜브 관련 상태
  const [videos, setVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState(false);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const CHANNEL_ID = 'UChlDg9qBmP_JlwQ1_2by5kQ';
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.status === 'ok' && data.items.length > 0) {
          const latestVideos = data.items.slice(0, 20).map((v: any) => {
            let thumb = v.thumbnail;
            if (thumb.includes('hqdefault')) {
              thumb = thumb.replace('hqdefault', 'mqdefault');
            }
            return { ...v, thumbnail: thumb };
          });
          setVideos(latestVideos);
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

  const getWeatherEmoji = (code: number) => {
    if (code === 0) return "☀️";
    if (code <= 3) return "⛅";
    if (code >= 61 && code <= 65) return "☔";
    if (code >= 71 && code <= 75) return "❄️";
    return "☁️";
  };

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
      fetchRates(); // 변경 후 정보 다시 불러오기
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
      window.location.href = '/'; // 메인으로 리다이렉트 (다시 세션 체크)
    } catch (error) {
      alert('회원가입 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div style={{textAlign:'center', marginTop:'50px'}}>로딩 중...</div>;

  if (isRegister) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
        <h2>⚽ 풋고추FC 회원가입</h2>
        <p>서비스 이용을 위해 추가 정보를 입력해주세요.</p>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <input type="hidden" name="userid" value={registerUserId || ''} />
          <div>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px' }}>이름(실명)</label>
            <input type="text" name="username" required style={{ width: '100%', padding: '10px' }} />
          </div>
          <div>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px' }}>닉네임</label>
            <input type="text" name="nickname" defaultValue={registerNickname || ''} required style={{ width: '100%', padding: '10px' }} />
          </div>
          <div>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '5px' }}>전화번호</label>
            <input type="text" name="phone" placeholder="010-1234-5678" required style={{ width: '100%', padding: '10px' }} />
          </div>
          <button type="submit" style={{ padding: '12px', backgroundColor: '#FEE500', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            가입 완료하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
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
                                            <span style={{ fontSize: 'calc(min(12px, 3vw) * var(--scale-factor, 1))', color: '#dc3545', marginLeft: '4px', fontWeight: 'bold' }}>
                                                [{rate.code_name}]
                                            </span>
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
                
                <div className="weather-card" style={{ marginTop: '20px' }}>
                  <div className="weather-location">월문3리 풋살구장 (07:00 ~ 09:00)</div>
                  <div id="weather-content">
                    {weatherError ? (
                      <p>날씨 정보를 불러오지 못했습니다.</p>
                    ) : !weatherData ? (
                      <p className="loading">데이터를 가져오는 중...</p>
                    ) : (
                      <>
                        <table className="weather-table">
                          <tbody>
                            <tr className="weather-header">
                              <th>시간</th>
                              <th>상태</th>
                              <th>기온</th>
                              <th>확률</th>
                              <th>강수량</th>
                            </tr>
                            {[weatherData.targetTime, weatherData.targetTime + 1, weatherData.targetTime + 2].map(hour => {
                              if (hour > 23) return null; // prevent out of bounds
                              const temp = weatherData.hourly.temperature_2m[hour];
                              const prob = weatherData.hourly.precipitation_probability[hour];
                              const amount = weatherData.hourly.precipitation[hour];
                              const code = weatherData.hourly.weathercode[hour];
                              return (
                                <tr key={hour} className="weather-row">
                                  <td className="weather-time">{hour}:00</td>
                                  <td>{getWeatherEmoji(code)}</td>
                                  <td className="weather-temp">{temp}°</td>
                                  <td className="weather-precip-prob">{prob}%</td>
                                  <td className="weather-precip-amount">{amount}mm</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '15px' }}>
                          기준일: {weatherData.dateStr}
                        </p>
                      </>
                    )}
                  </div>
                </div>
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
              <CalendarTab teamUid="df743e05-9440-4c1e-bfdb-fa07159ef0c9" members={rates} isAdmin={user?.auth_cd === '01'} />
            )}

            {activeTab === 'TEAM' && <TeamTab isAdmin={user?.auth_cd === '01'} />}

            {activeTab === 'MY' && user && (
              <div className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#eee', 
                    margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    👤
                  </div>
                  <h3 style={{ margin: 0 }}>{user.username || '이름 없음'}</h3>
                  <p style={{ margin: '5px 0 0 0', color: '#888' }}>{user.nickname}</p>
                </div>
                
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
                <button onClick={handleLogout} className="btn" style={{ 
                  marginTop: '30px', 
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
  );
}

export default App;
