// 공유 링크로 들어왔을 때 열 화면 (예: /?go=payment → 팀 탭 입금 안내)
// 로그인이 필요하면 카카오 로그인을 다녀오는 동안 sessionStorage 에 보관했다가 이어서 엶

export type DeepLink = 'payment';

const PARAM = 'go';
const STORAGE_KEY = 'pendingDeepLink';
const VALID: DeepLink[] = ['payment'];

export const deepLinkPath = (target: DeepLink) => `/?${PARAM}=${target}`;

const isDeepLink = (v: string | null): v is DeepLink => !!v && (VALID as string[]).includes(v);

// 주소에서 꺼내고 주소는 정리 (새로고침해도 다시 이동하지 않도록)
export function takeDeepLinkFromUrl(): DeepLink | null {
  const params = new URLSearchParams(window.location.search);
  const target = params.get(PARAM);
  if (!params.has(PARAM)) return null;
  params.delete(PARAM);
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return isDeepLink(target) ? target : null;
}

// 로그인 다녀오는 동안 보관
export function rememberDeepLink(target: DeepLink | null) {
  try {
    if (target) sessionStorage.setItem(STORAGE_KEY, target);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* 저장소를 쓸 수 없으면 홈으로 열림 */ }
}

export function takeRememberedDeepLink(): DeepLink | null {
  try {
    const target = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return isDeepLink(target) ? target : null;
  } catch {
    return null;
  }
}
