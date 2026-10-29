import { useEffect, useState } from 'react';
import api from '../api';
import SoccerBallLoader from './SoccerBallLoader';
import { useToast } from './Toast';
import { usePermission } from '../permissions';
import './SettingsTab.css';

const TEAM_UID = 'df743e05-9440-4c1e-bfdb-fa07159ef0c9';

interface PermissionItem {
  perm_cd: string;
  screen: string;
  name: string;
  description: string;
}

interface Role {
  auth_cd: string;
  name: string;
  locked: boolean; // 관리자: 항상 전체 권한
}

interface MemberRole {
  member_uid: string;
  member_name: string;
  user_id: string;
  auth_cd: string;
}

type Grants = Record<string, string[]>;

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every(x => b.includes(x));

export default function SettingsTab() {
  const { reload: reloadMyPermissions } = usePermission();
  const { toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [savedGrants, setSavedGrants] = useState<Grants>({});
  const [grants, setGrants] = useState<Grants>({});
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [myUserid, setMyUserid] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [matrixRes, memberRes, userRes, meRes] = await Promise.all([
          api.get('/permission/matrix'),
          api.get('/team_member/search', { params: { team_uid: TEAM_UID } }),
          api.get('/user/get'),
          api.get('/permission/me'),
        ]);
        setPermissions(matrixRes.data.permissions);
        setRoles(matrixRes.data.roles);
        setSavedGrants(matrixRes.data.grants);
        setGrants(matrixRes.data.grants);
        setMyUserid(meRes.data.userid);

        const authByUser = new Map<string, string>((userRes.data || []).map((u: any) => [u.userid, u.auth_cd]));
        setMemberRoles((memberRes.data || [])
          .filter((m: any) => m.user_id && authByUser.has(m.user_id))
          .map((m: any) => ({ member_uid: m.member_uid, member_name: m.member_name, user_id: m.user_id, auth_cd: authByUser.get(m.user_id) || '' }))
          .sort((a: MemberRole, b: MemberRole) => a.member_name.localeCompare(b.member_name)));
      } catch (err) {
        console.error(err);
        showToast('설정 정보를 불러오지 못했습니다');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 역할별 권한 ──────────────────────────────────────────────────────────
  const toggleGrant = (authCd: string, permCd: string) => {
    setGrants(prev => {
      const current = prev[authCd] || [];
      const next = current.includes(permCd) ? current.filter(p => p !== permCd) : [...current, permCd];
      return { ...prev, [authCd]: next };
    });
  };

  const changedRoles = roles.filter(r => !r.locked && !sameSet(grants[r.auth_cd], savedGrants[r.auth_cd]));

  const saveGrants = async () => {
    if (changedRoles.length === 0) return;
    setBusy(true);
    try {
      for (const role of changedRoles) {
        await api.post('/permission/save', { auth_cd: role.auth_cd, perm_cds: grants[role.auth_cd] || [] });
      }
      setSavedGrants(grants);
      await reloadMyPermissions();
      showToast('✅ 권한이 저장되었습니다');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || '권한 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  // ── 회원 역할 ────────────────────────────────────────────────────────────
  const changeMemberRole = async (member: MemberRole, authCd: string) => {
    if (authCd === member.auth_cd) return;
    const roleName = roles.find(r => r.auth_cd === authCd)?.name ?? authCd;
    const isMe = member.user_id === myUserid;
    const warning = isMe ? '\n본인의 역할을 변경하면 이 설정 화면에 다시 들어오지 못할 수 있습니다.' : '';
    if (!window.confirm(`[${member.member_name}] 님의 역할을 '${roleName}'(으)로 변경하시겠습니까?${warning}`)) return;
    setBusy(true);
    try {
      await api.post('/user/update', { userid: member.user_id, auth_cd: authCd });
      setMemberRoles(prev => prev.map(m => (m.user_id === member.user_id ? { ...m, auth_cd: authCd } : m)));
      if (isMe) await reloadMyPermissions();
      showToast(`✅ ${member.member_name} 님의 역할이 변경되었습니다`);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || '역할 변경에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="card settings-card"><p className="settings-empty">설정 정보를 불러오는 중...</p></div>;
  }

  const screens = [...new Set(permissions.map(p => p.screen))];
  const gridStyle = { gridTemplateColumns: `minmax(0, 1fr) repeat(${roles.length}, 3.25rem)` };

  return (
    <div className="settings">
      <SoccerBallLoader visible={busy} message="저장하는 중..." />
      {toast}

      {/* 역할별 권한 */}
      <div className="card settings-card">
        <h3 className="settings-title">🔐 역할별 권한</h3>
        <p className="settings-desc">역할마다 사용할 수 있는 기능을 선택합니다. 관리자는 항상 모든 권한을 가집니다.</p>

        <div className="perm-grid perm-head" style={gridStyle}>
          <span />
          {roles.map(r => <span key={r.auth_cd} className="perm-role">{r.name}</span>)}
        </div>

        {screens.map(screen => (
          <div key={screen} className="perm-group">
            <div className="perm-screen">{screen}</div>
            {permissions.filter(p => p.screen === screen).map(p => (
              <div key={p.perm_cd} className="perm-grid perm-row" style={gridStyle}>
                <div className="perm-info">
                  <span className="perm-name">{p.name}</span>
                  <span className="perm-desc">{p.description}</span>
                </div>
                {roles.map(r => (
                  <label key={r.auth_cd} className="perm-check">
                    <input
                      type="checkbox"
                      checked={r.locked || (grants[r.auth_cd] || []).includes(p.perm_cd)}
                      disabled={r.locked}
                      onChange={() => toggleGrant(r.auth_cd, p.perm_cd)}
                      aria-label={`${r.name} - ${p.name}`}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        ))}

        <div className="settings-actions">
          <button className="settings-btn ghost" disabled={changedRoles.length === 0} onClick={() => setGrants(savedGrants)}>되돌리기</button>
          <button className="settings-btn primary" disabled={changedRoles.length === 0} onClick={saveGrants}>
            저장{changedRoles.length > 0 ? ` (${changedRoles.map(r => r.name).join(', ')})` : ''}
          </button>
        </div>
      </div>

      {/* 회원 역할 */}
      <div className="card settings-card">
        <h3 className="settings-title">👥 회원 역할</h3>
        <p className="settings-desc">카카오 계정이 연결된 선수만 표시됩니다.</p>
        {memberRoles.length === 0 ? (
          <p className="settings-empty">카카오 계정이 연결된 선수가 없습니다.</p>
        ) : (
          <ul className="member-role-list">
            {memberRoles.map(m => (
              <li key={m.user_id}>
                <span className="member-role-name">
                  {m.member_name}
                  {m.user_id === myUserid && <span className="member-role-me">나</span>}
                </span>
                <select value={m.auth_cd} onChange={e => changeMemberRole(m, e.target.value)}>
                  {roles.map(r => <option key={r.auth_cd} value={r.auth_cd}>{r.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
