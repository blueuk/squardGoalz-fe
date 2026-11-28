import { Children, Fragment, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react';

// 구글 Noto 이모지를 그림(SVG)으로 보여줌.
// 이모지 글꼴(Noto Color Emoji)은 아이폰 사파리·카카오톡 안 브라우저가 그리지 못해 빈칸이 되므로
// 글꼴 대신 그림 파일을 씀 → 아이폰·갤럭시·PC 모두 같은 구글 모양.
//   <Emoji char="🔥" />            글자 크기에 맞춰 (1.2em)
//   <Emoji char="⚠️" size={36} />  크기 지정
//   emojify('✅ 저장했어요')         문장 안 이모지를 그림으로 (토스트·알림창)
// 새 이모지는 src/assets/emoji/<코드>.svg 로 추가 (https://fonts.gstatic.com/s/e/notoemoji/latest/<코드>/emoji.svg)

const FILES = import.meta.glob('../assets/emoji/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  URLS[path.slice(path.lastIndexOf('/') + 1, -'.svg'.length)] = url;
}

// 이모지 글자 → 파일 이름 (변형 선택자 FE0F 는 뺌. 예: ⚠️ → 26a0)
const codeOf = (ch: string) =>
  Array.from(ch).filter(c => c !== '️').map(c => c.codePointAt(0)!.toString(16)).join('_');

export function hasEmoji(ch: string) {
  return codeOf(ch) in URLS;
}

interface EmojiProps {
  char: string;
  size?: number; // px. 없으면 글자 크기에 맞춤
  label?: string; // 읽어 줄 이름 (없으면 꾸밈으로 보고 건너뜀)
  className?: string;
}

export default function Emoji({ char, size, label, className }: EmojiProps) {
  const url = URLS[codeOf(char)];
  if (!url) return <span className={className}>{char}</span>; // 그림이 없는 이모지는 기기 기본으로
  return (
    <img
      className={className ? `emoji ${className}` : 'emoji'}
      src={url}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}

const EMOJI_RE = /((?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}])️?)/u;

// 문장(또는 자식 노드) 안의 이모지를 그림으로 바꿈
export function emojify(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    const parts = node.split(EMOJI_RE);
    if (parts.length === 1) return node;
    return parts.map((p, i) => (i % 2 === 1 && hasEmoji(p) ? <Emoji key={i} char={p} /> : <Fragment key={i}>{p}</Fragment>));
  }
  if (Array.isArray(node)) return Children.map(node, emojify);
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.props.children === undefined) return el;
    return cloneElement(el, undefined, emojify(el.props.children));
  }
  return node;
}
