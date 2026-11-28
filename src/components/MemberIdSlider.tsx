import { useEffect, useRef, useState, type ReactNode } from 'react';
import './MemberIdSlider.css';
import Icon from './Icon';

interface Props<T extends { member_uid: string }> {
  members: T[];
  renderCard: (member: T) => ReactNode;
  onCurrentChange?: (memberUid: string) => void; // 넘겨서 가운데 카드가 바뀌면 알림
}

// 선수 신분증 카드 가로 슬라이더: 손가락으로 넘기거나 PC에서는 화살표로 이동 (한 장씩 맞춰 멈춤)
export default function MemberIdSlider<T extends { member_uid: string }>({ members, renderCard, onCurrentChange }: Props<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // 화면 가운데에 가장 가까운 카드를 현재 카드로
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      const cards = Array.from(track.children) as HTMLElement[];
      let best = 0;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        const bestDist = Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center);
        if (dist < bestDist) best = i;
      });
      setIndex(best);
    };
    update();
    track.addEventListener('scroll', update, { passive: true });
    return () => track.removeEventListener('scroll', update);
  }, [members.length]);

  // 가운데 카드가 바뀌면 부모에 알림 (펼친 능력치가 따라오도록)
  const currentUid = members[index]?.member_uid;
  useEffect(() => {
    if (currentUid) onCurrentChange?.(currentUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUid]);

  const go = (next: number) => {
    const track = trackRef.current;
    const card = track?.children[Math.max(0, Math.min(members.length - 1, next))] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  if (members.length === 0) {
    return <p className="id-slider-empty">등록된 선수가 없습니다.</p>;
  }

  return (
    <div className="id-slider">
      <div className="id-slider-track" ref={trackRef}>
        {members.map(m => (
          <div key={m.member_uid} className="id-slider-slide">{renderCard(m)}</div>
        ))}
      </div>
      <div className="id-slider-nav">
        <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="이전 선수"><Icon name="caret-left" size={20} /></button>
        <span>{index + 1} / {members.length}</span>
        <button onClick={() => go(index + 1)} disabled={index >= members.length - 1} aria-label="다음 선수"><Icon name="caret-right" size={20} /></button>
      </div>
    </div>
  );
}
