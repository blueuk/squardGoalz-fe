// 카카오톡 공유 (Kakao JavaScript SDK)
// JavaScript 키는 화면 코드에 그대로 공개되는 값이며, 카카오 개발자 콘솔에 등록한 웹 도메인에서만 동작함
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY || 'a8aad86b62039a4817411c57d224a384';
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
export const KAKAO_TEXT_LIMIT = 200; // 텍스트 템플릿 본문 최대 길이

interface KakaoSdk {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (settings: unknown) => void };
}

declare global {
  interface Window { Kakao?: KakaoSdk }
}

let loading: Promise<KakaoSdk> | null = null;

// SDK는 공유 버튼을 처음 누를 때만 불러옴 (다른 화면 로딩에 영향 없음)
const loadKakao = (): Promise<KakaoSdk> => {
  if (!loading) {
    loading = new Promise<KakaoSdk>((resolve, reject) => {
      const ready = () => {
        const kakao = window.Kakao;
        if (!kakao) return reject(new Error('카카오 SDK를 불러오지 못했습니다.'));
        if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY);
        resolve(kakao);
      };
      if (window.Kakao) return ready();
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = ready;
      script.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    }).catch(err => {
      loading = null; // 다음 시도 때 다시 불러오도록
      throw err;
    });
  }
  return loading;
};

// 텍스트 메시지 공유: 카카오톡 공유 창이 열림. 메시지 버튼을 누르면 앱의 path 로 이동
export async function shareKakaoText(text: string, buttonTitle = '앱에서 보기', path = '/') {
  if (text.length > KAKAO_TEXT_LIMIT) throw new Error(`공유 문구가 ${KAKAO_TEXT_LIMIT}자를 넘습니다.`);
  const kakao = await loadKakao();
  const url = window.location.origin + path;
  kakao.Share.sendDefault({
    objectType: 'text',
    text,
    link: { mobileWebUrl: url, webUrl: url },
    buttonTitle,
  });
}
