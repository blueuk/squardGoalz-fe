// 로컬 미리보기 전용 api (vite.preview.config.ts 에서 src/api.ts 대신 사용, 운영 빌드에는 포함되지 않음)
// - 로그인: 가짜 세션 (?role=admin 관리자 / ?role=user 일반). 카카오 로그인은 운영 주소로만 돌아오므로 로컬에서 쓸 수 없음
// - 조회(GET): 운영 서버 데이터를 그대로 읽음. 로그인이 필요한 조회는 빈 결과로 대신함
// - 저장·삭제(POST): 서버로 보내지 않음 (운영 데이터가 바뀌지 않도록)
import axios from 'axios';

const real = axios.create({ withCredentials: true });
const TEAM_UID = 'df743e05-9440-4c1e-bfdb-fa07159ef0c9';

const role = new URLSearchParams(window.location.search).get('role') === 'user' ? 'user' : 'admin';

const ALL_PERMISSIONS = [
  'arrange.manage', 'schedule.manage', 'vote.manage', 'schedule.past', 'team.edit', 'payment.edit',
  'weight.manage', 'member.manage', 'member.terminated', 'score.view', 'score.edit', 'auth.manage',
];
const USER_PERMISSIONS = ['schedule.manage', 'vote.manage']; // 일반 역할 기본 권한

// 미리보기 사용자: 선수 명단의 실제 선수로 (관리자는 첫 번째, 일반은 두 번째 선수)
let previewMember: Promise<{ member_uid: string; member_name: string } | undefined> | null = null;
const getPreviewMember = () => {
  previewMember ??= real.get('/team_member/search', { params: { team_uid: TEAM_UID } })
    .then(res => (res.data as { member_uid: string; member_name: string }[])
      .sort((a, b) => a.member_name.localeCompare(b.member_name))[role === 'admin' ? 0 : 1]);
  return previewMember;
};
const previewUserid = `preview-${role}`;

const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {}, config: {} });

const api = {
  async get(url: string, config?: { params?: Record<string, unknown> }) {
    const path = url.split('?')[0];
    if (path === '/kakao/session') {
      return ok({ userid: previewUserid, nickname: role === 'admin' ? '미리보기 관리자' : '미리보기 일반' });
    }
    // 전체 회원 조회는 로그인이 필요하므로, 계정이 연결된 선수에게 가짜 전화번호를 붙여 화면 확인용으로 돌려줌
    if (path === '/user/get' && !config?.params?.userid) {
      const res = await real.get('/team_member/search', { params: { team_uid: TEAM_UID } });
      return ok((res.data as { user_id?: string }[])
        .filter(m => m.user_id)
        .map((m, i) => ({ userid: m.user_id, phone: `0101234${String(i).padStart(4, '0')}` })));
    }
    if (path === '/user/get') {
      const m = await getPreviewMember();
      return ok([{ userid: previewUserid, username: m?.member_name ?? '미리보기', phone: '01012345678', auth_cd: role === 'admin' ? '01' : '02' }]);
    }
    if (path === '/permission/me') {
      return ok({ userid: previewUserid, auth_cd: role === 'admin' ? '01' : '02', permissions: role === 'admin' ? ALL_PERMISSIONS : USER_PERMISSIONS, approved: true });
    }
    try {
      const res = await real.get(url, config);
      // 미리보기 사용자를 실제 선수에 연결 (MY 화면, 본인 투표 등이 동작하도록)
      if (path === '/rate/search' || path === '/team_member/search') {
        const m = await getPreviewMember();
        if (m && Array.isArray(res.data)) {
          res.data = res.data.map((r: { member_uid?: string }) => (r.member_uid === m.member_uid ? { ...r, user_id: previewUserid } : r));
        }
      }
      return res;
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.info(`[미리보기] 로그인이 필요한 조회라 빈 결과로 대신함: ${url}`);
        return ok([]);
      }
      throw err;
    }
  },
  async post(url: string, body?: unknown) {
    console.info('[미리보기] 저장하지 않음:', url, body);
    return ok({ message: '(미리보기) 저장하지 않음', version: String(Date.now()), linked: true });
  },
};

export default api;
