// 디자인 시스템 공통 부품 도우미 (스타일은 src/styles/ui.css)

// 선수 상태 코드 → 라벨 색 (01 활동 · 02 부상 · 03 육아)
export function statusLabelClass(statusCd?: string | null): string {
  if (statusCd === '02') return 'ui-label is-injury';
  if (statusCd === '03') return 'ui-label is-parent';
  return 'ui-label is-active';
}
