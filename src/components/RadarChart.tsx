import { RADAR_CATEGORIES } from './positionUtils';

interface RadarChartProps {
  scores: { [key: string]: number };
  size?: number;
  showValues?: boolean;
}

export default function RadarChart({ scores, size = 260, showValues = true }: RadarChartProps) {
  const center = size / 2;
  const radius = (size / 2) * 0.65; // 마진 확보
  const numAxes = RADAR_CATEGORIES.length; // 6
  const angleStep = (2 * Math.PI) / numAxes;

  // 꼭짓점 좌표 계산 (맨 위 -90도부터 시계방향)
  const getCoordinates = (index: number, r: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // 배경 6각형 그리드 (4단계: 25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((level) => {
    const points = RADAR_CATEGORIES.map((_, i) => {
      const { x, y } = getCoordinates(i, radius * level);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  // 데이터 다각형 꼭짓점 계산 (0~20점 정규화)
  const dataPoints = RADAR_CATEGORIES.map((cat, i) => {
    const rawVal = scores[cat.key] ?? 13;
    const clamped = Math.max(0, Math.min(20, rawVal));
    const r = (clamped / 20) * radius;
    return getCoordinates(i, r);
  });
  const dataPolygonString = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {/* 배경 6각형 가이드 라인 */}
        {gridPolygons.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill={idx === gridPolygons.length - 1 ? '#f8fafd' : 'none'}
            stroke="#e5e8eb"
            strokeWidth="1"
          />
        ))}

        {/* 중심에서 꼭짓점으로 뻗는 축 라인 */}
        {RADAR_CATEGORIES.map((_, i) => {
          const outer = getCoordinates(i, radius);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="#e5e8eb"
              strokeWidth="1"
            />
          );
        })}

        {/* 채워진 데이터 다각형 */}
        <polygon
          points={dataPolygonString}
          fill="rgba(49, 130, 246, 0.22)"
          stroke="var(--toss-blue, #3182f6)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* 데이터 포인트 원 */}
        {dataPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill="#fff"
            stroke="var(--toss-blue, #3182f6)"
            strokeWidth="2"
          />
        ))}

        {/* 축 라벨 및 수치 */}
        {RADAR_CATEGORIES.map((cat, i) => {
          const labelDist = radius + 22;
          const { x, y } = getCoordinates(i, labelDist);
          const val = scores[cat.key] ?? 13;

          let textAnchor: 'start' | 'end' | 'middle' = 'middle';
          let dy = '0.35em';
          if (i === 0) {
            dy = '-0.3em';
          } else if (i === 3) {
            dy = '1.0em';
          } else if (x > center) {
            textAnchor = 'start';
          } else if (x < center) {
            textAnchor = 'end';
          }

          return (
            <text
              key={cat.key}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dy={dy}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                fill: '#4e5968',
                userSelect: 'none'
              }}
            >
              {cat.label}
              {showValues && (
                <tspan fill="var(--toss-blue, #3182f6)" fontWeight="bold" dx="3">
                  {val.toFixed(1)}
                </tspan>
              )}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
