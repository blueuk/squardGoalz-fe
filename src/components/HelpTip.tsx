import { useEffect, useRef, useState, type ReactNode } from 'react';
import './HelpTip.css';
import Icon from './Icon';

// 제목 옆 ? 버튼: 누르면 설명이 열리고, 다시 누르거나 바깥을 누르거나 Esc를 누르면 닫힘
export default function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className="help-tip" ref={ref}>
      <button className="help-tip-btn" onClick={() => setOpen(v => !v)} title={label} aria-label={label} aria-expanded={open}><Icon name="question" size={16} /></button>
      {open && <div className="help-tip-pop" role="tooltip">{children}</div>}
    </span>
  );
}
