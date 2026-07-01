import React, { useRef, useState, useMemo } from 'react';

/* ─── Line Chart (Monte Carlo Simulation) ─── */

interface LineChartProps {
  data: { month: number; value: number }[][];
  width?: number;
  height?: number;
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 800,
  height = 400,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const { paths, gradientPath, xLabels, yLabels, gridLinesY, gridLinesX } = useMemo(() => {
    if (!data || data.length === 0) return { paths: [], gradientPath: '', xLabels: [], yLabels: [], gridLinesY: [], gridLinesX: [] };

    const padding = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let allValues: number[] = [];
    data.forEach(series => series.forEach(p => allValues.push(p.value)));
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const valRange = maxVal - minVal || 1;
    const yMin = minVal - valRange * 0.1;
    const yMax = maxVal + valRange * 0.1;

    let maxMonth = 0;
    data.forEach(series => series.forEach(p => { if (p.month > maxMonth) maxMonth = p.month; }));
    if (maxMonth === 0) maxMonth = 1;

    const scaleX = (m: number) => padding.left + (m / maxMonth) * chartW;
    const scaleY = (v: number) => padding.top + (1 - (v - yMin) / (yMax - yMin)) * chartH;

    const buildPath = (series: { month: number; value: number }[]) => {
      return series.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.month).toFixed(2)},${scaleY(p.value).toFixed(2)}`).join(' ');
    };

    const computedPaths = data.map((series, idx) => ({
      d: buildPath(series),
      index: idx,
    }));

    // Gradient fill under the main (11th, index=10) path
    let gradPath = '';
    if (data.length > 10 && data[10].length > 0) {
      const mainSeries = data[10];
      const linePart = buildPath(mainSeries);
      const lastX = scaleX(mainSeries[mainSeries.length - 1].month).toFixed(2);
      const firstX = scaleX(mainSeries[0].month).toFixed(2);
      const baseY = (padding.top + chartH).toFixed(2);
      gradPath = `${linePart} L${lastX},${baseY} L${firstX},${baseY} Z`;
    }

    // X labels every 12 months
    const xLbls: { x: number; label: string }[] = [];
    for (let m = 0; m <= maxMonth; m += 12) {
      xLbls.push({ x: scaleX(m), label: `${Math.floor(m / 12)}y` });
    }

    // Y labels (5 ticks)
    const yLbls: { y: number; label: string }[] = [];
    const gridY: number[] = [];
    const gridX: number[] = [];
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const val = yMin + (i / tickCount) * (yMax - yMin);
      const y = scaleY(val);
      yLbls.push({ y, label: val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}` });
      gridY.push(y);
    }
    for (let m = 0; m <= maxMonth; m += 12) {
      gridX.push(scaleX(m));
    }

    return {
      paths: computedPaths,
      gradientPath: gradPath,
      xLabels: xLbls,
      yLabels: yLbls,
      gridLinesY: gridY,
      gridLinesX: gridX,
    };
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return <div className={className} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No projection data</div>;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="lineGradientFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06d6a0" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06d6a0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLinesY.map((y, i) => (
        <line key={`gy-${i}`} x1={padding.left} x2={padding.left + chartW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {gridLinesX.map((x, i) => (
        <line key={`gx-${i}`} x1={x} x2={x} y1={padding.top} y2={padding.top + chartH} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}

      {/* Gradient fill under main path */}
      {gradientPath && (
        <path d={gradientPath} fill="url(#lineGradientFill)" opacity="0.15" />
      )}

      {/* Simulation paths */}
      {paths.map(({ d, index }) => {
        // First 10 paths: muted cyan
        if (index < 10) {
          return <path key={index} d={d} fill="none" stroke="#06d6a0" strokeWidth="1" opacity="0.15" />;
        }
        // 11th path (index 10): main/median
        if (index === 10) {
          return <path key={index} d={d} fill="none" stroke="#06d6a0" strokeWidth="2" opacity="1" />;
        }
        // 12th path (index 11): worst case
        if (index === 11) {
          return <path key={index} d={d} fill="none" stroke="#ef476f" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.85" />;
        }
        // Any additional paths
        return <path key={index} d={d} fill="none" stroke="#06d6a0" strokeWidth="1" opacity="0.1" />;
      })}

      {/* Y axis labels */}
      {yLabels.map((lbl, i) => (
        <text key={`yl-${i}`} x={padding.left - 10} y={lbl.y + 4} textAnchor="end" fill="var(--text-muted, #64748b)" fontSize="11" fontFamily="Inter, sans-serif">
          {lbl.label}
        </text>
      ))}

      {/* X axis labels */}
      {xLabels.map((lbl, i) => (
        <text key={`xl-${i}`} x={lbl.x} y={padding.top + chartH + 25} textAnchor="middle" fill="var(--text-muted, #64748b)" fontSize="11" fontFamily="Inter, sans-serif">
          {lbl.label}
        </text>
      ))}
    </svg>
  );
};

/* ─── Donut Chart ─── */

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  size = 220,
  className,
  centerLabel,
  centerValue,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { arcs, total } = useMemo(() => {
    const tot = segments.reduce((s, seg) => s + seg.value, 0);
    if (tot === 0) return { arcs: [], total: 0 };

    const radius = (size - 56) / 2;
    const circumference = 2 * Math.PI * radius;
    const gapAngle = 0.03; // radians gap between segments
    const totalGap = gapAngle * segments.length;
    const availableAngle = 2 * Math.PI - totalGap;

    let currentOffset = 0;
    const computedArcs = segments.map((seg, i) => {
      const fraction = seg.value / tot;
      const segAngle = fraction * availableAngle;
      const dashLen = (segAngle / (2 * Math.PI)) * circumference;
      const dashOffset = -(currentOffset / (2 * Math.PI)) * circumference;
      currentOffset += segAngle + gapAngle;

      return {
        ...seg,
        index: i,
        radius,
        circumference,
        dashArray: `${dashLen} ${circumference - dashLen}`,
        dashOffset,
        percentage: (fraction * 100).toFixed(1),
      };
    });

    return { arcs: computedArcs, total: tot };
  }, [segments, size]);

  const center = size / 2;

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {arcs.map((arc) => (
          <circle
            key={arc.index}
            cx={center}
            cy={center}
            r={arc.radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={28}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: hoveredIdx === arc.index ? `scale(1.05)` : 'scale(1)',
              transformOrigin: `${center}px ${center}px`,
              filter: hoveredIdx === arc.index ? `drop-shadow(0 0 8px ${arc.color})` : 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHoveredIdx(arc.index)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}
      </svg>

      {/* Center text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {centerValue && (
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
            {centerValue}
          </div>
        )}
        {centerLabel && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
            {centerLabel}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && arcs[hoveredIdx] && (
        <div
          className="chart-tooltip"
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '0.8rem',
            color: '#f1f5f9',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ color: arcs[hoveredIdx].color, marginRight: 6 }}>●</span>
          {arcs[hoveredIdx].label}: {arcs[hoveredIdx].percentage}%
        </div>
      )}
    </div>
  );
};
