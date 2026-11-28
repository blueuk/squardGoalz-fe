import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import api from '../api';
import RadarChart from './RadarChart';
import { PositionLabels } from './TeamTab';
import FutsalMbtiTest, { MbtiMeters, MbtiSummary } from './FutsalMbti';
import { TYPES, savedPct, type SavedMbti } from './mbtiData';
import {
  calculateRadarScores, DEFAULT_POSITION_WEIGHTS, buildWeightsFromRows,
  getCachedPositionWeights, setCachedPositionWeights,
} from './positionUtils';
import { useToast } from './Toast';
import { statusLabelClass } from './ui';
import { profileImageUrl, resizeProfileImage } from './profileImage';
import './MyTab.css';
import Icon from './Icon';

const TEAM_UID = 'df743e05-9440-4c1e-bfdb-fa07159ef0c9';

interface MyUser {
  userid: string;
  nickname: string;
  username?: string;
  phone?: string;
  auth_cd?: string;
}

interface MyInfo {
  team_uid: string;
  member_uid?: string;
  status_cd?: string;
  code_name?: string;
}

interface StatusOption {
  code: string;
  code_name: string;
}

interface Props {
  user: MyUser;
  myInfo?: MyInfo;               // 선수 명단(참석률)에서 찾은 내 정보
  onStatusChanged: () => void;   // 상태 변경 후 참석률 다시 조회
  onLogout: () => void;
}

const formatPhone = (p?: string) => {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p || '-';
};

export default function MyTab({ user, myInfo, onStatusChanged, onLogout }: Props) {
  const memberUid = myInfo?.member_uid;
  const { toast, showToast } = useToast();

  // 능력치 / 참가 경기
  const [scores, setScores] = useState<any[]>([]);
  const [weights, setWeights] = useState<Record<string, Record<string, number>>>(
    () => getCachedPositionWeights() || DEFAULT_POSITION_WEIGHTS
  );
  const [attendCount, setAttendCount] = useState(0);
  const [scoresLoading, setScoresLoading] = useState(false);

  // 풋살 MBTI
  const [mbtiList, setMbtiList] = useState<SavedMbti[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [showTest, setShowTest] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  // 상태 토글
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [statusCd, setStatusCd] = useState(myInfo?.status_cd);
  const [statusSaving, setStatusSaving] = useState(false);

  // 프로필 사진: 버전이 있으면 사진 있음 (주소에 붙여 바뀔 때만 다시 받음)
  const [photoVersion, setPhotoVersion] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setStatusCd(myInfo?.status_cd); }, [myInfo?.status_cd]);

  useEffect(() => {
    if (!memberUid) return;
    api.get('/profile/search', { params: { team_uid: TEAM_UID, member_uid: memberUid } })
      .then(res => setPhotoVersion(res.data?.[0]?.version ?? null))
      .catch(err => console.error('프로필 사진 조회 실패:', err));
  }, [memberUid]);

  const uploadPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 사진을 다시 골라도 동작하도록
    if (!file || !memberUid) return;
    setPhotoBusy(true);
    try {
      const blob = await resizeProfileImage(file);
      const form = new FormData();
      form.append('team_uid', TEAM_UID);
      form.append('member_uid', memberUid);
      form.append('file', blob, blob.type === 'image/webp' ? 'profile.webp' : 'profile.jpg');
      const res = await api.post('/profile/upload', form);
      setPhotoVersion(res.data.version);
      showToast(`✅ 프로필 사진을 바꿨어요 (${Math.round(blob.size / 1024)}KB)`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || err.message || '프로필 사진을 저장하지 못했습니다');
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    if (!memberUid || !window.confirm('프로필 사진을 삭제할까요?')) return;
    setPhotoBusy(true);
    try {
      await api.post('/profile/delete', { team_uid: TEAM_UID, member_uid: memberUid });
      setPhotoVersion(null);
      showToast('프로필 사진을 삭제했어요');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || '프로필 사진을 삭제하지 못했습니다');
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    api.get('/common_cd/search', { params: { group_cd: 'status_cd' } })
      .then(res => setStatusOptions(
        (res.data || [])
          .filter((c: any) => c.group_cd === 'status_cd' && c.use_yn !== 'N')
          .sort((a: any, b: any) => a.code.localeCompare(b.code))
      ))
      .catch(err => console.error('상태 코드를 불러오지 못했습니다.', err));
  }, []);

  useEffect(() => {
    if (!memberUid) return;
    const load = async () => {
      setScoresLoading(true);
      try {
        const cachedWeights = getCachedPositionWeights();
        const [rateRes, scoreRes, weightRes] = await Promise.all([
          api.get('/rate/search', { params: { team_uid: TEAM_UID, member_uid: memberUid, year: String(new Date().getFullYear()) } }),
          api.get('/memberScore/search', { params: { team_uid: TEAM_UID, member_uid: memberUid } }),
          cachedWeights ? Promise.resolve(null) : api.get('/position_point/search'),
        ]);
        if (rateRes.data?.length > 0) setAttendCount(rateRes.data[0].attend_count);
        setScores(scoreRes.data || []);
        if (cachedWeights) {
          setWeights(cachedWeights);
        } else if (weightRes?.data && weightRes.data.length > 0) {
          const loaded = buildWeightsFromRows(weightRes.data);
          setCachedPositionWeights(loaded);
          setWeights(loaded);
        }
      } catch (err) {
        console.error('내 데이터 조회 실패:', err);
      } finally {
        setScoresLoading(false);
      }
    };
    load();
    loadMbti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberUid]);

  const loadMbti = async () => {
    try {
      const [mbtiRes, memberRes] = await Promise.all([
        api.get('/mbti/search', { params: { team_uid: TEAM_UID } }),
        api.get('/team_member/search', { params: { team_uid: TEAM_UID } }),
      ]);
      setMbtiList(mbtiRes.data || []);
      setMemberNames(Object.fromEntries((memberRes.data || []).map((m: any) => [m.member_uid, m.member_name])));
    } catch (err) {
      console.error('풋살 MBTI 조회 실패:', err);
    }
  };

  const changeStatus = async (code: string) => {
    if (!myInfo?.member_uid || code === statusCd || statusSaving) return;
    const prev = statusCd;
    setStatusCd(code);
    setStatusSaving(true);
    try {
      await api.post('/team_member/update', { team_uid: myInfo.team_uid, member_uid: myInfo.member_uid, status_cd: code });
      showToast(`✅ 상태를 '${statusOptions.find(o => o.code === code)?.code_name}'(으)로 바꿨어요`);
      onStatusChanged();
    } catch (err) {
      console.error(err);
      setStatusCd(prev);
      showToast('상태 변경에 실패했습니다');
    } finally {
      setStatusSaving(false);
    }
  };

  // 내 결과: 필드 결과를 대표로, 없으면 골레이 결과
  const myField = mbtiList.find(m => m.member_uid === memberUid && m.test_type === 'field');
  const myGk = mbtiList.find(m => m.member_uid === memberUid && m.test_type === 'gk');
  const myMain = myField ?? myGk;

  // 나와 잘 맞는 팀원: 내 유형의 궁합 유형(필드)을 가진 선수 명단의 팀원
  const matches = myMain
    ? (TYPES[myMain.mbti_cd]?.match ?? []).map(code => ({
      code,
      names: mbtiList
        .filter(m => m.test_type === 'field' && m.mbti_cd === code && m.member_uid !== memberUid && memberNames[m.member_uid])
        .map(m => memberNames[m.member_uid])
        .sort((a, b) => a.localeCompare(b)),
    }))
    : [];

  const roleLabel = user.auth_cd === '01' ? '관리자' : '일반';
  const statusName = statusOptions.find(o => o.code === statusCd)?.code_name ?? myInfo?.code_name;

  return (
    <div className="my">
      {toast}
      {showTest && memberUid && (
        <FutsalMbtiTest
          teamUid={TEAM_UID}
          memberUid={memberUid}
          onClose={() => setShowTest(false)}
          onSaved={loadMbti}
        />
      )}

      {/* 프로필 */}
      <section className="my-card my-profile">
        {memberUid ? (
          <button
            className="my-avatar editable"
            onClick={() => fileInput.current?.click()}
            disabled={photoBusy}
            aria-label="프로필 사진 바꾸기"
            title="프로필 사진 바꾸기"
          >
            {photoVersion ? <img src={profileImageUrl(TEAM_UID, memberUid, photoVersion)} alt="" /> : '👤'}
            <span className="my-avatar-cam">{photoBusy ? '…' : <Icon name="camera" weight="fill" size={16} />}</span>
          </button>
        ) : (
          <div className="my-avatar">👤</div>
        )}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={uploadPhoto} />
        <div className="my-profile-text">
          <div className="my-name">{user.username || '이름 없음'}</div>
          <div className="my-nick">{user.nickname}</div>
          {photoVersion && memberUid && (
            <button className="ui-btn ui-btn-text is-muted my-photo-delete" onClick={deletePhoto} disabled={photoBusy}>사진 삭제</button>
          )}
        </div>
        <div className="my-badges">
          {statusName && <span className={statusLabelClass(statusCd)}>{statusName}</span>}
          {myMain && <span className="ui-label is-info">{myMain.mbti_cd}</span>}
        </div>
      </section>

      {/* 내 능력치 분석 */}
      <section className="my-card">
        <h3 className="my-title">내 능력치 분석</h3>
        {scoresLoading ? (
          <p className="my-empty">능력치를 분석하는 중이에요...</p>
        ) : scores.length > 0 ? (
          <>
            <div className="my-radar">
              <RadarChart scores={calculateRadarScores(scores)} size={220} showValues={true} />
            </div>
            <div className="my-subtitle">포지션별 환산 점수 (100점 만점)</div>
            <PositionLabels memberScoreList={scores} positionWeights={weights} />
          </>
        ) : (
          <p className="my-empty">등록된 능력치 정보가 없어요.</p>
        )}
      </section>

      {/* 풋살 MBTI */}
      <section className="my-card">
        <div className="my-title-row">
          <h3 className="my-title">풋살 MBTI</h3>
          {myMain && memberUid && <button className="ui-btn ui-btn-text" onClick={() => setShowTest(true)}>다시 하기</button>}
        </div>
        {!memberUid ? (
          <p className="my-empty">선수 명단에 연결된 계정만 테스트할 수 있어요.</p>
        ) : !myMain ? (
          <div className="my-mbti-empty">
            <p>나는 피보일까, 픽소일까?<br />4가지 축으로 나의 풋살 유형을 알아보세요.</p>
            <button className="ui-btn ui-btn-lg ui-btn-block ui-btn-primary" onClick={() => setShowTest(true)}>풋살 MBTI 테스트 하기</button>
          </div>
        ) : (
          <>
            <MbtiSummary code={myMain.mbti_cd} compact />
            <div className="my-mbti-meters">
              <MbtiMeters testType={myMain.test_type} pct={savedPct(myMain)} />
            </div>
            {myField && myGk && (
              <div className="my-mbti-extra">
                골레이 유형 <b>{myGk.mbti_cd}</b> · {TYPES[myGk.mbti_cd]?.name}
              </div>
            )}
            <button className="ui-btn ui-btn-md ui-btn-block my-btn-gap ui-btn-neutral" onClick={() => setShowMatches(v => !v)} aria-expanded={showMatches}>
              {showMatches ? '접기' : '나와 잘 맞는 팀원 보기'}
            </button>
            {showMatches && (
              <ul className="my-matches">
                {matches.map(m => (
                  <li key={m.code}>
                    <div className="my-match-type">
                      <b>{m.code}</b> {TYPES[m.code]?.name}
                    </div>
                    <div className="my-match-names">
                      {m.names.length > 0 ? m.names.map(n => <span key={n} className="my-chip">{n}</span>) : <span className="my-muted">아직 이 유형인 팀원이 없어요</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* 내 정보 */}
      <section className="my-card">
        <h3 className="my-title">내 정보</h3>
        <div className="my-row status">
          <span className="my-label">내 상태</span>
          {statusOptions.length > 0 && myInfo?.member_uid ? (
            <div className="ui-seg ui-seg-sm" role="radiogroup" aria-label="내 상태">
              {statusOptions.map(o => (
                <button
                  key={o.code}
                  role="radio"
                  aria-checked={statusCd === o.code}
                  className={statusCd === o.code ? 'on' : ''}
                  disabled={statusSaving}
                  onClick={() => changeStatus(o.code)}
                >
                  {o.code_name}
                </button>
              ))}
            </div>
          ) : (
            <span className="my-value">{statusName || '-'}</span>
          )}
        </div>
        <div className="my-row"><span className="my-label">권한</span><span className="my-value">{roleLabel}</span></div>
        <div className="my-row"><span className="my-label">올해 참가 경기</span><span className="my-value accent">{attendCount}회</span></div>
        <div className="my-row"><span className="my-label">소속팀</span><span className="my-value">풋고추FC</span></div>
        <div className="my-row"><span className="my-label">전화번호</span><span className="my-value">{formatPhone(user.phone)}</span></div>
        <div className="my-row"><span className="my-label">카카오 ID</span><span className="my-value">{user.userid}</span></div>
        <div className="my-row">
          <span className="my-label">MemberID</span>
          <span className="my-value ellipsis" title={memberUid}>{memberUid || '-'}</span>
        </div>
      </section>

      <button className="ui-btn ui-btn-md ui-btn-block my-btn-gap ui-btn-neutral my-logout" onClick={onLogout}>로그아웃</button>
    </div>
  );
}
