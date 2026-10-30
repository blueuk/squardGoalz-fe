import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from './api';

// 백엔드 permission/permissionCatalog.py 와 같은 코드
export type PermissionCode =
  | 'arrange.manage'
  | 'schedule.manage'
  | 'vote.manage'
  | 'schedule.past'
  | 'team.edit'
  | 'payment.edit'
  | 'weight.manage'
  | 'member.manage'
  | 'member.terminated'
  | 'score.view'
  | 'score.edit'
  | 'auth.manage';

interface PermissionState {
  authCd: string | null;
  approved: boolean; // false: 가입했지만 선수 명단에 연결되지 않은 승인 대기
  loaded: boolean;
  can: (code: PermissionCode) => boolean;
  reload: () => Promise<void>;
}

const PermissionContext = createContext<PermissionState>({
  authCd: null,
  approved: true,
  loaded: false,
  can: () => false,
  reload: async () => {},
});

export function PermissionProvider({ userid, children }: { userid?: string | null; children: ReactNode }) {
  const [authCd, setAuthCd] = useState<string | null>(null);
  const [approved, setApproved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!userid) {
      setAuthCd(null);
      setApproved(true);
      setPermissions(new Set());
      setLoaded(true);
      return;
    }
    try {
      const res = await api.get('/permission/me');
      setAuthCd(res.data.auth_cd ?? null);
      setApproved(res.data.approved !== false);
      setPermissions(new Set(res.data.permissions || []));
    } catch (err) {
      console.error('권한 정보를 불러오지 못했습니다.', err);
      setPermissions(new Set());
    } finally {
      setLoaded(true);
    }
  }, [userid]);

  useEffect(() => { reload(); }, [reload]);

  const can = useCallback((code: PermissionCode) => permissions.has(code), [permissions]);

  return <PermissionContext.Provider value={{ authCd, approved, loaded, can, reload }}>{children}</PermissionContext.Provider>;
}

export const usePermission = () => useContext(PermissionContext);
