import { useEffect, useState } from 'react';
import api from '../api';
import './PendingMembersCard.css';

const NEW_MEMBER = '__new__';

interface PendingUser {
  userid: string;
  username?: string;
  nickname?: string;
  phone?: string;
  create_dt?: string;
}

interface LinkableMember {
  member_uid: string;
  member_name: string;
  user_id?: string;
}

interface Props {
  teamUid: string;
  members: LinkableMember[];          // 선수단 명단 (계정 미연결 선수를 연결 후보로 사용)
  onApproved: () => Promise<void>;    // 명단/능력치 다시 불러오기
  showToast: (message: string) => void;
}

const formatPhone = (p?: string) => {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p || '';
};

const formatDate = (dt?: string) => {
  if (!dt) return '';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

// [권한: member.manage] 가입했지만 선수 명단에 연결되지 않은 회원 승인
export default function PendingMembersCard({ teamUid, members, onApproved, showToast }: Props) {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({}); // userid -> member_uid | NEW_MEMBER
  const [busyUserid, setBusyUserid] = useState<string | null>(null);

  const linkable = members.filter(m => !m.user_id);

  useEffect(() => {
    api.get('/team_member/pending/search', { params: { team_uid: teamUid } })
      .then(res => setPending(res.data || []))
      .catch(err => console.error('승인 대기 목록을 불러오지 못했습니다.', err));
  }, [teamUid]);

  // 기본 선택: 이름이 같은 미연결 선수가 있으면 그 선수, 없으면 신규 등록
  const targetOf = (u: PendingUser) =>
    targets[u.userid] ?? linkable.find(m => m.member_name === u.username)?.member_uid ?? NEW_MEMBER;

  const approve = async (u: PendingUser) => {
    const target = targetOf(u);
    const linkedName = linkable.find(m => m.member_uid === target)?.member_name;
    const message = linkedName
      ? `[${u.username}] 님의 계정을 기존 선수 [${linkedName}] 에 연결하시겠습니까?`
        + (linkedName !== u.username ? `\n계정 이름도 '${linkedName}'(으)로 변경됩니다.` : '')
      : `[${u.username}] 님을 신규 선수로 선수 명단에 등록하시겠습니까?\n(기본 능력치 13점 부여)`;
    if (!window.confirm(message)) return;

    setBusyUserid(u.userid);
    try {
      await api.post('/team_member/approve', {
        team_uid: teamUid,
        userid: u.userid,
        member_uid: target === NEW_MEMBER ? null : target,
      });
      setPending(prev => prev.filter(p => p.userid !== u.userid));
      await onApproved();
      showToast(`✅ ${u.username} 님의 가입을 승인했습니다`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || '가입 승인에 실패했습니다');
    } finally {
      setBusyUserid(null);
    }
  };

  const reject = async (u: PendingUser) => {
    if (!window.confirm(`[${u.username}] 님의 가입을 거절하시겠습니까?\n계정 정보가 삭제되며, 다시 카카오 로그인하면 가입부터 다시 진행합니다.`)) return;
    setBusyUserid(u.userid);
    try {
      await api.post('/team_member/reject', { team_uid: teamUid, userid: u.userid });
      setPending(prev => prev.filter(p => p.userid !== u.userid));
      showToast(`${u.username} 님의 가입을 거절했습니다`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || '가입 거절에 실패했습니다');
    } finally {
      setBusyUserid(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="card squad-card pending-card">
      <div className="pending-head">
        <div>
          <h3 className="pending-title">🙋 가입 승인 대기</h3>
          <p className="pending-desc">선수 명단에 없는 회원입니다. 기존 선수에 연결하거나 신규 선수로 등록해주세요.</p>
        </div>
        <span className="pending-count">{pending.length}명</span>
      </div>

      <ul className="pending-list">
        {pending.map(u => {
          const busy = busyUserid === u.userid;
          return (
            <li key={u.userid} className="pending-row">
              <div className="pending-info">
                <span className="pending-name">
                  {u.username}
                  {u.nickname && u.nickname !== u.username && <span className="pending-nick">({u.nickname})</span>}
                </span>
                <span className="pending-meta">
                  {[formatPhone(u.phone), formatDate(u.create_dt) && `가입 ${formatDate(u.create_dt)}`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="pending-actions">
                <select
                  value={targetOf(u)}
                  disabled={busy}
                  onChange={e => setTargets(prev => ({ ...prev, [u.userid]: e.target.value }))}
                  aria-label={`${u.username} 연결할 선수`}
                >
                  <option value={NEW_MEMBER}>신규 선수로 등록</option>
                  {linkable.map(m => <option key={m.member_uid} value={m.member_uid}>{m.member_name} 에 연결</option>)}
                </select>
                <button className="pending-btn approve" disabled={busy} onClick={() => approve(u)}>승인</button>
                <button className="pending-btn reject" disabled={busy} onClick={() => reject(u)}>거절</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
