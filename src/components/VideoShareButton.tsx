import { copyText } from './clipboard';
import { shareKakaoFeed } from './kakaoShare';
import { useToast } from './Toast';
import { deepLinkPath, YOUTUBE_CHANNEL_URL } from '../deepLink';

interface Video {
  title: string;
  thumbnail?: string;
  published?: string;
}

// 영상 제목 앞의 경기일 (예: "2026년 11월 21일 5세트" → "2026년 11월 21일")
const matchDateOf = (title: string) => title.match(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/)?.[0] ?? null;

// "이번 주 영상 업로드" 카카오톡 공유: 최신 경기일의 영상 수와 첫 썸네일로 카드를 보내고, 버튼은 유튜브 채널로
export default function VideoShareButton({ videos }: { videos: Video[] }) {
  const { toast, showToast } = useToast();
  if (videos.length === 0) return null;

  const share = async () => {
    const latest = videos[0];
    const date = matchDateOf(latest.title);
    const count = date ? videos.filter(v => matchDateOf(v.title) === date).length : 0;
    const title = '🎬 이번 주 경기 영상이 업로드됐어요!';
    const description = date ? `${date} 경기 · 영상 ${count}개` : latest.title;
    try {
      if (!latest.thumbnail) throw new Error('썸네일 없음');
      await shareKakaoFeed({ title, description, imageUrl: latest.thumbnail, buttonTitle: '유튜브에서 보기', path: deepLinkPath('youtube') });
    } catch (err) {
      console.error('카카오톡 공유 실패', err);
      const ok = await copyText(`${title}\n${description}\n${YOUTUBE_CHANNEL_URL}`);
      showToast(ok ? '카톡 공유를 열 수 없어 복사했어요. 카톡에 붙여넣어 주세요' : '공유에 실패했습니다');
    }
  };

  return (
    <>
      {toast}
      <button
        onClick={share}
        title="카카오톡으로 영상 업로드 소식 공유"
        aria-label="카카오톡으로 영상 업로드 소식 공유"
        style={{ padding: '4px 10px', border: 'none', borderRadius: '999px', background: '#fee500', color: '#191919', fontSize: 'calc(12px * var(--scale-factor, 1))', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        💬 공유
      </button>
    </>
  );
}
