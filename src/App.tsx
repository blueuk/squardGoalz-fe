import { useEffect, useState, type ReactNode } from 'react';
import api from './api';
import teamLogo from './img/teamlogo.webp';
import letterLogo from './img/letterLogo.png';
import './App.css';
import Icon, { type IconName } from './components/Icon';
import CalendarTab from './components/CalendarTab';
import TeamTab from './components/TeamTab';
import SoccerBallLoader from './components/SoccerBallLoader';
import HomeMatchCard from './components/HomeMatchCard';
import MyTab from './components/MyTab';
import HelpTip from './components/HelpTip';
import VideoShareButton from './components/VideoShareButton';
import { PermissionProvider } from './permissions';
import PendingGate from './components/PendingGate';
import { rememberDeepLink, takeDeepLinkFromUrl, takeRememberedDeepLink, YOUTUBE_CHANNEL_URL, type DeepLink } from './deepLink';
import { showAlert } from './components/Dialog';

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
  attend_streak?: number; // 최근 경기부터 연속 참석 수 (미진행 제외)
  miss_streak?: number;   // 최근 경기부터 연속 불참·미투표 수 (미진행 제외)
}

// 연속 기록 표시 기준
const FIRE_STREAK = 2; // 연속 참석
const TEAR_STREAK = 4; // 연속 불참·미투표

const streakIcon = (rate: Rate) => {
  if ((rate.attend_streak ?? 0) >= FIRE_STREAK) return { icon: '🔥', label: `${rate.attend_streak}회 연속 참석` };
  if ((rate.miss_streak ?? 0) >= TEAR_STREAK) return { icon: '😢', label: `${rate.miss_streak}회 연속 불참·미투표` };
  return null;
};

// 참석 현황에서 텍스트 대신 아이콘으로 보여줄 선수 상태 (없는 상태는 [상태명] 텍스트로 표시)
const STATUS_ICONS: Record<string, ReactNode> = {
  '육아': '🍼',
  '부상': '🩹',
};

// 하단 탭: 선택된 탭은 fill 아이콘
type TabKey = 'HOME' | 'VIDEO' | 'SCHEDULE' | 'TEAM' | 'MY';
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'HOME', label: '홈', icon: 'house' },
  { key: 'VIDEO', label: '영상', icon: 'play-circle' },
  { key: 'SCHEDULE', label: '일정', icon: 'calendar-blank' },
  { key: 'TEAM', label: '팀', icon: 'users-three' },
  { key: 'MY', label: 'MY', icon: 'user-circle' },
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Rate[]>([]);
  // 공유 링크(/?go=payment)로 들어오면 해당 화면으로. 로그인 전이면 로그인 후 이어서 엶
  const [deepLink, setDeepLink] = useState<DeepLink | null>(() => takeDeepLinkFromUrl() ?? takeRememberedDeepLink());
  const [activeTab, setActiveTab] = useState<'HOME' | 'VIDEO' | 'SCHEDULE' | 'TEAM' | 'MY'>(() => (deepLink === 'payment' ? 'TEAM' : deepLink === 'video' ? 'VIDEO' : 'HOME'));
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

  const fetchRates = async () => {
    try {
      const res = await api.get('/rate/search', {
        params: {
          team_uid: 'df743e05-9440-4c1e-bfdb-fa07159ef0c9',
          year: '2026',
          // 연속 기록은 오늘 이전 경기만 (휴대폰 날짜 기준)
          today: (() => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; })(),
        }
      });
      setRates(res.data);
    } catch (error) {
      console.error("참석률 조회 실패:", error);
    }
  };

  const handleKakaoLogin = () => {
    rememberDeepLink(deepLink);
    window.location.href = '/kakao/login';
  };

  const handleLogout = async () => {
    await api.post('/kakao/logout');
    setUser(null);
    setRates([]);
  };

  const queryParams = new URLSearchParams(window.location.search);
  const isRegister = window.location.pathname === '/register';
  const registerNickname = queryParams.get('nickname');

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

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const res = await api.post('/login/register', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      await showAlert(res.data?.linked
        ? '회원가입이 완료되었습니다!'
        : '회원가입이 완료되었습니다.\n관리자가 가입을 승인하면 이용할 수 있습니다.');
      window.location.href = '/';
    } catch (error: any) {
      showAlert(error.response?.data?.detail || '회원가입 중 오류가 발생했습니다.');
    }
  };

  // 로딩 모션 (축구공 좌우 롤링)
  if (loading) return <SoccerBallLoader message="풋고추FC 로딩 중..." />;

  if (isRegister) {
    return (
      <div className="register-page">
        <div className="register-card">
          <h2 className="register-title">풋고추FC 회원가입</h2>
          <p className="register-desc">서비스 이용을 위해 추가 정보를 입력해주세요.</p>
          <form className="register-form" onSubmit={handleRegister}>
            <label className="register-field">
              <span>이름(실명)</span>
              <input className="ui-input" type="text" name="username" autoComplete="name" required />
            </label>
            <label className="register-field">
              <span>닉네임</span>
              <input className="ui-input" type="text" name="nickname" autoComplete="nickname" defaultValue={registerNickname || ''} required />
            </label>
            <label className="register-field">
              <span>전화번호</span>
              {/* 숫자만 입력: 붙여넣기/자동완성으로 들어온 하이픈·공백도 제거 */}
              <input className="ui-input is-number"
                type="tel" name="phone" inputMode="numeric" autoComplete="tel"
                placeholder="01012345678" pattern="[0-9]{10,11}" title="숫자 10~11자리를 입력해주세요" required
                onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 11); }}
              />
            </label>
            <button className="ui-btn ui-btn-lg ui-btn-block register-submit ui-btn-primary" type="submit">가입 완료하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <PermissionProvider userid={user?.userid}>
    <PendingGate onLogout={handleLogout}>
    <div className="app-container">

      {!user ? (
        <div style={{ textAlign: 'center', marginTop: '100px', padding: '20px' }}>
          <img 
            src={teamLogo} 
            alt="Squard Goalz Logo" 
            style={{ width: '250px', height: 'auto', marginBottom: '10px' }} 
          />
          <p>서비스를 이용하시려면 카카오 로그인이 필요합니다.</p>
          <button className="ui-btn ui-btn-lg ui-btn-kakao" style={{ marginTop: '20px' }} 
            onClick={handleKakaoLogin}>
            카카오로 시작하기
          </button>
        </div>
      ) : (
        <>
          {/* Top Bar */}
          <header className="app-header">
            <img src={letterLogo} alt="" className="app-header-logo" />
            <span className="app-header-title">풋고추FC</span>
          </header>
          
          {/* Main Content */}
          <main className="app-main">
            {activeTab === 'HOME' && (
              <div id="home" className="section" style={{ display: 'block' }}>
                <div id="rate-card" className="card" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                      멤버 참석 현황
                      <HelpTip label="순위 계산 방식과 아이콘 설명">
                        <section>
                          <b>순위는 이렇게 매겨요 (올해 일정 기준)</b>
                          <ol>
                            <li>점수 = 참석 3점 + 불참 1점 − 미투표 2점</li>
                            <li>점수가 같으면 참석률 → 참석 수 → 경기 수가 많은 순</li>
                            <li>참석률 = 참석 ÷ (참석 + 불참 + 미투표). 미진행 경기는 빼요.</li>
                          </ol>
                        </section>
                        <section>
                          <b>아이콘 뜻</b>
                          <ul className="help-tip-icons">
                            <li><span>🔥</span>{FIRE_STREAK}경기 이상 연속 참석</li>
                            <li><span>😢</span>{TEAR_STREAK}경기 이상 연속 불참·미투표</li>
                            {Object.entries(STATUS_ICONS).map(([name, icon]) => <li key={name}><span>{icon}</span>{name} 중</li>)}
                            <li><span>👑</span>1위</li>
                          </ul>
                          <p style={{ margin: '0.4rem 0 0', color: '#8b95a1' }}>연속 기록은 지난 경기만 세고, 미진행 경기는 건너뛰어요.</p>
                        </section>
                      </HelpTip>
                    </div>
                    <div className="pager">
                      <button type="button" className="pager-btn" onClick={prevRollingPage} aria-label="이전 순위"><Icon name="caret-left" size={16} /></button>
                      <button type="button" id="rolling-toggle-btn" className="pager-btn" onClick={toggleRolling} aria-label={isRollingPlaying ? '자동 넘김 멈추기' : '자동 넘김 시작'}>
                        <Icon name={isRollingPlaying ? 'pause' : 'play'} weight="fill" size={16} />
                      </button>
                      <button type="button" className="pager-btn" onClick={nextRollingPage} aria-label="다음 순위"><Icon name="caret-right" size={16} /></button>
                    </div>
                  </div>
                  <div id="rolling-content" className="card-value" style={{ transition: 'opacity 0.3s ease-in-out', opacity: isFading ? 0 : 1 }}>
                    {rates.length > 0 ? (
                      rates
                        .sort((a, b) => a.rank_num - b.rank_num)
                        .slice(currentRollingIdx * ITEMS_PER_PAGE, (currentRollingIdx + 1) * ITEMS_PER_PAGE)
                        .map((rate, index) => {
                          const crown = rate.rank_num === 1 ? <span className="crown">👑</span> : null;
                          const streak = streakIcon(rate);
                          return (
                            <div key={index} className="rank-item">
                                <div className="rank-info" style={{ flexShrink: 1, minWidth: 0, overflow: 'hidden', marginRight: '4px' }}>
                                    <span className="rank-num" style={{ fontSize: 'calc(min(15px, 3.8vw) * var(--scale-factor, 1))' }}>{rate.rank_num}위</span>
                                    <span className="rank-name" style={{ fontSize: 'calc(min(15px, 3.8vw) * var(--scale-factor, 1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {rate.member_name}
                                        {streak && (
                                            <span title={streak.label} aria-label={streak.label} style={{ fontSize: 'calc(min(14px, 3.5vw) * var(--scale-factor, 1))', marginLeft: '4px' }}>
                                                {streak.icon}
                                            </span>
                                        )}
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
                                    <span className="rank-counts">
                                        참석 {rate.attend_count} · 불참 {rate.absent_count} · 미투표 {rate.no_vote_count}
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
                
                <HomeMatchCard onGoSchedule={() => setActiveTab('SCHEDULE')} />
              </div>
            )}

            {activeTab === 'VIDEO' && (
              <div className="section" style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span>최신 경기 영상</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <VideoShareButton videos={videos} />
                    <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="text-link">
                      채널 바로가기<Icon name="arrow-square-out" size={16} />
                    </a>
                    </span>
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

            {activeTab === 'TEAM' && <TeamTab focusPayment={deepLink === 'payment'} onFocused={() => setDeepLink(null)} />}

            {activeTab === 'MY' && user && (
              <MyTab user={user} myInfo={myInfo} onStatusChanged={fetchRates} onLogout={handleLogout} />
            )}
          </main>

          {/* 하단 탭: 아래에 아이폰 홈 막대 높이만큼 독을 깔고 그 위에 탭을 올림 */}
          <nav className="tabbar" aria-label="메뉴">
            {TABS.map(tab => {
              const on = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={on ? 'tabbar-tab on' : 'tabbar-tab'}
                  aria-current={on ? 'page' : undefined}
                  onClick={() => (tab.key === 'HOME' ? window.location.reload() : setActiveTab(tab.key))}
                >
                  <Icon name={tab.icon} weight={on ? 'fill' : 'regular'} size={24} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}
    </div>
    </PendingGate>
    </PermissionProvider>
  );
}

export default App;
