import { useEffect, useRef, useState } from 'react';
import './Toast.css';

const TOAST_DURATION = 2000;

// 하단 탭바 위에 2초간 표시되는 토스트
export function useToast() {
  const [current, setCurrent] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = (text: string) => {
    window.clearTimeout(timer.current);
    // id 가 바뀌어야 같은 문구를 연속으로 띄워도 애니메이션이 다시 시작됨
    setCurrent(prev => ({ id: (prev?.id ?? 0) + 1, text }));
    timer.current = window.setTimeout(() => setCurrent(null), TOAST_DURATION);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toast = current ? <div key={current.id} className="app-toast" role="status">{current.text}</div> : null;
  return { toast, showToast };
}
