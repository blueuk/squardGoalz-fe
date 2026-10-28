import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../api';
import SoccerBallLoader from './SoccerBallLoader';
import { buildWeightsFromRows, getCachedPositionWeights, setCachedPositionWeights } from './positionUtils';
import {
  arrangeTeams, MAX_TEAM_COUNT, MIN_TEAM_SIZE, MAX_TEAM_SIZE,
  type ArrangedMember, type ArrangeParticipant
} from './teamArrangeUtils';
import orangeTeam from '../img/orangeTeam.png';
import greenTeam from '../img/greenTeam.png';
import blueTeam from '../img/blueTeam.png';
import pinkTeam from '../img/pinkTeam.png';
import './HomeMatchCard.css';

const TEAM_UID = 'df743e05-9440-4c1e-bfdb-fa07159ef0c9';

// team_no 1~4 순서
const TEAM_STYLES = [
  { name: '오렌지', img: orangeTeam, color: '#ff6b1a' },
  { name: '그린', img: greenTeam, color: '#2ecc71' },
  { name: '블루', img: blueTeam, color: '#3182f6' },
  { name: '핑크', img: pinkTeam, color: '#ff5c9a' },
];

const DEFAULT_LOCATION = { name: '월문3리 풋살구장', lat: 37.58, lon: 127.24 };
const WEATHER_HOURS = 3; // 종료시간이 없으므로 시작시간부터 3개(2시간) 표시
const WEATHER_MIN_SCALE = 0.7; // 날씨 라벨 최소 축소 비율 (12px -> 8.4px)

interface Schedule {
  vote_seq: number;
  team_uid: string;
  play_date: string;        // YYYYMMDD
  play_start_time?: string; // HH:MM
  play_location?: string;
}

interface WeatherHour {
  hour: number;
  code: number;
  temp: number;
  precip: number;
}

const getWeatherEmoji = (code: number) => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code >= 51 && code <= 67) return '☔';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '☁️';
};

const getCoords = (location?: string) => {
  if (location?.includes('다산')) return { lat: 37.618, lon: 127.158 };
  return { lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon };
};

const formatPlayDate = (d: string) => {
  const date = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)));
  const day = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${day})`;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// 팀 배정 모달 기본값
const DEFAULT_TEAM_COUNT = 2;
const DEFAULT_TEAM_SIZE = 6;

export default function HomeMatchCard({ isAdmin }: { isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [weather, setWeather] = useState<WeatherHour[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [arrangement, setArrangement] = useState<ArrangedMember[]>([]);

  // 배정 모달 / 미리보기
  const [showModal, setShowModal] = useState(false);
  const [participants, setParticipants] = useState<ArrangeParticipant[]>([]);
  const [weights, setWeights] = useState<Record<string, Record<string, number>>>({});
  const [mercCount, setMercCount] = useState(0);
  const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
  const [teamSize, setTeamSize] = useState(DEFAULT_TEAM_SIZE);
  const [preview, setPreview] = useState<ArrangedMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');

  // ── 날씨 라벨을 항상 한 줄로: 넘치면 폭에 맞춰 글자 크기 축소 (최소 70%) ──────
  const weatherRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = weatherRef.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--weather-scale', '1');
      const ratio = el.clientWidth / el.scrollWidth;
      el.style.setProperty('--weather-scale', String(Math.max(WEATHER_MIN_SCALE, Math.min(1, ratio * 0.98))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, weather, weatherError]);

  // ── 최근 일정 + 날씨 + 배정 이력 ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const schedRes = await api.get('/schedule/search', { params: { team_uid: TEAM_UID } });
        const schedules: Schedule[] = schedRes.data || [];
        // 경기일자가 가장 늦은 일정 (같은 날이면 나중에 등록된 일정)
        const latest = [...schedules].sort((a, b) =>
          b.play_date.localeCompare(a.play_date) || b.vote_seq - a.vote_seq
        )[0];
        if (!mounted) return;
        setSchedule(latest ?? null);
        if (!latest) return;

        const [arrRes] = await Promise.all([
          api.get('/teamArrange/search', { params: { team_uid: TEAM_UID, vote_seq: latest.vote_seq } }),
          loadWeather(latest),
        ]);
        if (mounted) setArrangement(arrRes.data || []);
      } catch (err) {
        console.error('경기 정보를 불러오지 못했습니다.', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const loadWeather = async (s: Schedule) => {
      try {
        const { lat, lon } = getCoords(s.play_location);
        const dateStr = `${s.play_date.slice(0, 4)}-${s.play_date.slice(4, 6)}-${s.play_date.slice(6, 8)}`;
        const startHour = parseInt((s.play_start_time || '07:00').split(':')[0], 10) || 7;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,weathercode&timezone=Asia%2FSeoul&start_date=${dateStr}&end_date=${dateStr}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || !data.hourly) throw new Error(data.reason || 'no forecast');
        const hours: WeatherHour[] = [];
        for (let h = startHour; h < startHour + WEATHER_HOURS && h <= 23; h++) {
          if (data.hourly.temperature_2m[h] == null) continue;
          hours.push({
            hour: h,
            code: data.hourly.weathercode[h],
            temp: data.hourly.temperature_2m[h],
            precip: data.hourly.precipitation[h],
          });
        }
        if (mounted) setWeather(hours);
      } catch (err) {
        console.error('날씨 정보를 불러오지 못했습니다.', err);
        if (mounted) setWeatherError(true);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  // ── 배정 폼 열기: 참석자 / 능력치 / 가중치 로드 ───────────────────────────
  const openForm = async () => {
    if (!schedule) return;
    setBusy(true);
    setBusyMessage('참석자 정보를 불러오는 중...');
    try {
      const cachedWeights = getCachedPositionWeights();
      const [voteRes, memberRes, scoreRes, weightRes] = await Promise.all([
        api.get('/vote/search', { params: { team_uid: TEAM_UID, vote_seq: schedule.vote_seq } }),
        api.get('/team_member/search', { params: { team_uid: TEAM_UID } }),
        api.get('/memberScore/search', { params: { team_uid: TEAM_UID } }),
        cachedWeights ? Promise.resolve(null) : api.get('/position_point/search'),
      ]);

      const loadedWeights = cachedWeights || buildWeightsFromRows(weightRes?.data);
      if (!cachedWeights) setCachedPositionWeights(loadedWeights);
      setWeights(loadedWeights);

      const nameMap = new Map<string, string>((memberRes.data || []).map((m: any) => [m.member_uid, m.member_name]));
      const scores: any[] = scoreRes.data || [];
      const list: ArrangeParticipant[] = (voteRes.data || [])
        .filter((v: any) => v.vote_cd === '02' && nameMap.has(v.member_uid))
        .map((v: any) => ({
          member_uid: v.member_uid,
          member_name: nameMap.get(v.member_uid)!,
          scores: scores.filter(s => s.member_uid === v.member_uid),
        }));
      setParticipants(list);

      setTeamCount(DEFAULT_TEAM_COUNT);
      setTeamSize(DEFAULT_TEAM_SIZE);
      setShowModal(true);
    } catch (err) {
      console.error(err);
      alert('참석자 정보를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const runArrange = () => {
    if (participants.length + mercCount === 0) {
      alert('참석자가 없습니다. 투표 현황 또는 용병 수를 확인해주세요.');
      return;
    }
    setPreview(arrangeTeams(participants, weights, { mercCount, teamCount, teamSize }));
    setShowModal(false);
  };

  // 현재 설정(용병 수, 팀 수, 팀당 인원) 그대로 다시 섞기
  const rerollArrange = () => {
    setPreview(arrangeTeams(participants, weights, { mercCount, teamCount, teamSize }));
  };

  const saveArrange = async () => {
    if (!schedule || !preview) return;
    if (arrangement.length > 0 && !window.confirm('기존 팀 배정 이력을 새 배정으로 교체하시겠습니까?')) return;
    setBusy(true);
    setBusyMessage('팀 배정을 저장하는 중...');
    try {
      await api.post('/teamArrange/save', {
        team_uid: TEAM_UID,
        vote_seq: schedule.vote_seq,
        members: preview.map(({ member_uid, member_name, merc_yn, team_no, keeper_order }) =>
          ({ member_uid, member_name, merc_yn, team_no, keeper_order })),
      });
      setArrangement(preview);
      setPreview(null);
      alert('팀 배정이 저장되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || '팀 배정 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  const renderTeams = (members: ArrangedMember[]) => {
    const teamNos = [...new Set(members.map(m => m.team_no))].sort((a, b) => a - b);
    return (
      <div className="arrange-teams">
        {teamNos.map(no => {
          const style = TEAM_STYLES[no - 1] ?? TEAM_STYLES[0];
          const teamMembers = members.filter(m => m.team_no === no).sort((a, b) => a.keeper_order - b.keeper_order);
          return (
            <div key={no} className="arrange-team" style={{ borderTopColor: style.color }}>
              <div className="arrange-team-head" style={{ color: style.color }}>
                {style.name}팀 <span className="arrange-team-count">{teamMembers.length}명</span>
              </div>
              <ul className="arrange-team-list">
                {teamMembers.map(m => (
                  <li key={m.member_uid}>
                    {/* 유니폼 이미지 안에 키퍼 순번 */}
                    <span className="arrange-jersey">
                      <img src={style.img} alt="" />
                      <span className="arrange-jersey-no">{m.keeper_order}</span>
                    </span>
                    <span className="arrange-name" style={{ backgroundColor: style.color }}>{m.member_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModal = () => (
    <div className="arrange-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="arrange-modal" onClick={e => e.stopPropagation()}>
        <h3 className="arrange-modal-title">팀 배정</h3>
        <div className="arrange-form-fields">
          <label>
            용병 수
            <input type="number" min={0} max={20} value={mercCount}
              onChange={e => setMercCount(clamp(parseInt(e.target.value, 10) || 0, 0, 20))} />
          </label>
          <label>
            팀 수
            <select value={teamCount} onChange={e => setTeamCount(Number(e.target.value))}>
              {Array.from({ length: MAX_TEAM_COUNT - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}팀</option>)}
            </select>
          </label>
          <label>
            팀당 인원
            <select value={teamSize} onChange={e => setTeamSize(Number(e.target.value))}>
              {Array.from({ length: MAX_TEAM_SIZE - MIN_TEAM_SIZE + 1 }, (_, i) => i + MIN_TEAM_SIZE).map(n => <option key={n} value={n}>{n}명</option>)}
            </select>
          </label>
        </div>
        <div className="arrange-actions">
          <button className="arrange-btn ghost" onClick={() => setShowModal(false)}>취소</button>
          <button className="arrange-btn green" onClick={runArrange}>배정하기</button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="card match-card"><p className="match-empty">경기 정보를 불러오는 중...</p></div>;
  }

  if (!schedule) {
    return <div className="card match-card"><p className="match-empty">등록된 일정이 없습니다.</p></div>;
  }

  return (
    <div className="card match-card">
      <SoccerBallLoader visible={busy} message={busyMessage} />
      {showModal && renderModal()}

      {preview && (
        <button className="arrange-reroll" onClick={rerollArrange} title="같은 설정으로 다시 섞기" aria-label="같은 설정으로 다시 섞기">
          ↻
        </button>
      )}

      {/* 구장명 / 날짜 요일 라벨 */}
      <div className={`match-label${preview ? ' with-reroll' : ''}`}>
        <span className="match-chip">📍 {schedule.play_location || DEFAULT_LOCATION.name}</span>
        <span className="match-chip">📅 {formatPlayDate(schedule.play_date)}</span>
      </div>

      <div className="match-weather" ref={weatherRef}>
        {weatherError ? (
          <span className="match-weather-empty">날씨 예보 없음</span>
        ) : !weather ? (
          <span className="match-weather-empty">날씨 불러오는 중...</span>
        ) : weather.length === 0 ? (
          <span className="match-weather-empty">날씨 예보 없음</span>
        ) : (
          weather.map(w => (
            <span key={w.hour} className="match-weather-chip">
              <b>{String(w.hour).padStart(2, '0')}시</b>
              <span>{getWeatherEmoji(w.code)}</span>
              <span>{w.temp}°</span>
              <span className="precip">{w.precip}mm</span>
            </span>
          ))
        )}
      </div>

      {preview ? (
        <>
          <div className="arrange-preview-badge">미리보기 · 저장 전</div>
          {renderTeams(preview)}
          <div className="arrange-actions">
            <button className="arrange-btn ghost" onClick={() => setPreview(null)}>취소</button>
            <button className="arrange-btn green" onClick={saveArrange}>저장</button>
          </div>
        </>
      ) : arrangement.length > 0 ? (
        <>
          {renderTeams(arrangement)}
          {isAdmin && (
            <div className="arrange-actions">
              <button className="arrange-btn ghost" onClick={openForm}>다시 배정</button>
            </div>
          )}
        </>
      ) : isAdmin ? (
        <button className="arrange-btn big" onClick={openForm}>배정하기</button>
      ) : (
        <p className="match-empty">아직 팀 배정 전입니다.</p>
      )}
    </div>
  );
}
