import {
  Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

// 앱 디자인 셀렉트박스. 펼친 목록까지 직접 그림 (휴대폰 기본 휠·팝업 대신).
// <select> 자리에 그대로 씀: 자식 <option value>라벨</option>, onChange(e) 의 e.target.value 도 같음.
//   <Select className="ui-select-sm" value={x} onChange={e => setX(e.target.value)}>
//     <option value="a">가</option>
//   </Select>

interface Option {
  value: string;
  label: string;
  disabled: boolean;
}

interface SelectProps {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string; // 'ui-select-sm' 이면 작은 크기
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node).map(n => (typeof n === 'string' || typeof n === 'number' ? String(n) : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : '')).join('');

function readOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.toArray(children).forEach(child => {
    if (!isValidElement(child) || child.type !== 'option') return;
    const props = (child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>).props;
    const label = textOf(props.children);
    out.push({ value: String(props.value ?? label), label, disabled: !!props.disabled });
  });
  return out;
}

const LIST_MAX_H = 288; // 6개 정도
const GAP = 4;

export default function Select({ value, onChange, children, className = '', style, disabled, id, 'aria-label': ariaLabel }: SelectProps) {
  const options = readOptions(children);
  const current = String(value);
  const selectedIndex = options.findIndex(o => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vh = window.innerHeight;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const width = Math.max(r.width, 160);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    if (below >= Math.min(LIST_MAX_H, 200) || below >= above) {
      setPos({ left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX_H, below) });
    } else {
      setPos({ left, width, bottom: vh - r.top + GAP, maxHeight: Math.min(LIST_MAX_H, above) });
    }
  }, []);

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const openList = () => {
    if (disabled) return;
    place();
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex(o => !o.disabled));
    setOpen(true);
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== current) onChange({ target: { value: o.value } });
    close();
  };

  // 열려 있는 동안: 바깥 누르면 닫기, 스크롤·화면 크기 바뀌면 위치 다시
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close, place]);

  // 열리면 목록에 포커스, 고른 항목이 보이게
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => step(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => step(a, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(step(options.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };

  const size = className.includes('ui-select-sm') ? ' ui-select-sm' : '';
  const extra = className.replace(/\bui-select(-sm)?\b/g, '').trim();

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`ui-select${size}${open ? ' is-open' : ''}${extra ? ` ${extra}` : ''}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        <span className="ui-select-value">{options[selectedIndex]?.label ?? '선택'}</span>
        <Icon name="caret-down" size={16} className="ui-select-caret" />
      </button>
      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="ui-select-list"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === current}
              aria-disabled={o.disabled || undefined}
              className={`ui-select-option${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => !o.disabled && setActive(i)}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {o.value === current && <Icon name="check" size={18} className="ui-select-check" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
