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
  can: (code: PermissionCode) => boolean;
  reload: () => Promise<void>;
}

const PermissionContext = createContext<PermissionState>({
  authCd: null,
  can: () => false,
  reload: async () => {},
});

export function PermissionProvider({ userid, children }: { userid?: string | null; children: ReactNode }) {
  const [authCd, setAuthCd] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!userid) {
      setAuthCd(null);
      setPermissions(new Set());
      return;
    }
    try {
      const res = await api.get('/permission/me');
      setAuthCd(res.data.auth_cd ?? null);
      setPermissions(new Set(res.data.permissions || []));
    } catch (err) {
      console.error('권한 정보를 불러오지 못했습니다.', err);
      setPermissions(new Set());
    }
  }, [userid]);

  useEffect(() => { reload(); }, [reload]);

  const can = useCallback((code: PermissionCode) => permissions.has(code), [permissions]);

  return <PermissionContext.Provider value={{ authCd, can, reload }}>{children}</PermissionContext.Provider>;
}

export const usePermission = () => useContext(PermissionContext);
