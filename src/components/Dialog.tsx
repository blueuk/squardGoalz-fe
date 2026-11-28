import { useEffect, useRef, useState, type ReactNode } from 'react';
import { emojify } from './Emoji';

// 브라우저 기본 alert / confirm 대신 쓰는 앱 디자인 알림창
//   showAlert('저장되었습니다.')                       → 확인 버튼 하나
//   if (!(await showConfirm('삭제할까요?', { tone: 'danger', confirmText: '삭제' }))) return;
// <DialogHost /> 는 main.tsx 에서 한 번만 그림. 여러 개가 동시에 오면 차례로 보여줌.

type Tone = 'primary' | 'danger';

interface DialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
}

interface DialogRequest extends DialogOptions {
  id: number;
  kind: 'alert' | 'confirm';
  message: ReactNode;
  resolve: (ok: boolean) => void;
}

let seq = 0;
let enqueue: ((req: DialogRequest) => void) | null = null;

function open(kind: DialogRequest['kind'], message: ReactNode, opts: DialogOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    if (!enqueue) {
      // 알림창이 아직 그려지지 않은 경우 (거의 없음) 브라우저 기본 창으로
      const text = typeof message === 'string' ? message : '';
      resolve(kind === 'confirm' ? window.confirm(text) : (window.alert(text), true));
      return;
    }
    enqueue({ ...opts, id: ++seq, kind, message, resolve });
  });
}

export function showAlert(message: ReactNode, opts?: DialogOptions): Promise<void> {
  return open('alert', message, opts).then(() => undefined);
}

export function showConfirm(message: ReactNode, opts?: DialogOptions): Promise<boolean> {
  return open('confirm', message, opts);
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = req => setQueue(q => [...q, req]);
    return () => { enqueue = null; };
  }, []);

  const close = (ok: boolean) => {
    if (!current) return;
    current.resolve(ok);
    setQueue(q => q.slice(1));
  };

  useEffect(() => {
    if (!current) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(current.kind === 'alert'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const isConfirm = current.kind === 'confirm';
  const tone = current.tone ?? 'primary';

  return (
    <div className="ui-modal-overlay" onClick={() => close(!isConfirm)}>
      <div
        className="ui-modal"
        role={isConfirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={current.title ? `ui-dialog-title-${current.id}` : undefined}
        aria-describedby={`ui-dialog-msg-${current.id}`}
        onClick={e => e.stopPropagation()}
      >
        {current.title && <h3 className="ui-modal-title" id={`ui-dialog-title-${current.id}`}>{current.title}</h3>}
        <div className="ui-modal-body" id={`ui-dialog-msg-${current.id}`}>{emojify(current.message)}</div>
        <div className="ui-modal-actions">
          {isConfirm && (
            <button type="button" className="ui-btn ui-btn-md ui-btn-neutral" onClick={() => close(false)}>
              {current.cancelText ?? '취소'}
            </button>
          )}
          <button
            type="button"
            ref={okRef}
            className={`ui-btn ui-btn-md ${tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-primary'}`}
            onClick={() => close(true)}
          >
            {current.confirmText ?? '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
