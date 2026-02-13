import React, { useEffect, useState, useMemo } from "react";

// --- Helpers ---

/**
 * Calculates the control point for a Bezier curve.
 */
const controlPoint = (current, previous, next, reverse) => {
  const p = previous || current;
  const n = next || current;
  const smoothing = 0.2;
  const line = (pointA, pointB) => {
    const lengthX = pointB[0] - pointA[0];
    const lengthY = pointB[1] - pointA[1];
    return {
      length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
      angle: Math.atan2(lengthY, lengthX),
    };
  };
  const o = line(p, n);
  const angle = o.angle + (reverse ? Math.PI : 0);
  const length = o.length * smoothing;
  const x = current[0] + Math.cos(angle) * length;
  const y = current[1] + Math.sin(angle) * length;
  return [x, y];
};

/**
 * Generates a smooth SVG path d attribute from an array of points [x, y].
 */
const svgPath = (points) => {
  const d = points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point[0]},${point[1]}`;
    const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
    const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
    return `${acc} C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
  }, "");
  return d;
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

// --- Components ---

export const DamageSparkline = ({
  data,
  color = "#3b82f6",
  height = 60,
  width = 240,
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!data || data.length === 0) return null;

  // Increased padding to prevent clipping of stroke caps and markers
  const padding = 16;
  const effectiveWidth = width;
  const effectiveHeight = height;

  const maxVal = Math.max(...data.map((d) => d.damage));
  const minVal = 0;

  const points = useMemo(() => {
    return data.map((d, i) => {
      const x =
        (i / (data.length - 1)) * (effectiveWidth - padding * 2) + padding;
      const y =
        effectiveHeight -
        ((d.damage - minVal) / (maxVal - minVal || 1)) *
          (effectiveHeight - padding * 2) -
        padding;
      return [x, y];
    });
  }, [data, effectiveHeight, effectiveWidth, maxVal, minVal]);

  const pathD = useMemo(() => svgPath(points), [points]);
  const areaD = `${pathD} L ${effectiveWidth - padding},${effectiveHeight} L ${padding},${effectiveHeight} Z`;
  const pathLength = 1000;

  return (
    <div className="flex flex-col items-center relative w-full h-full justify-center">
      <style>{`
          .animate-draw {
            animation: drawLine 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          .animate-fade-in {
            animation: fadeIn 1.5s ease-out forwards;
          }
          @keyframes drawLine {
            from { stroke-dashoffset: ${pathLength}; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={`grad-${color.replace("#", "")}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <path
          d={areaD}
          fill={`url(#grad-${color.replace("#", "")})`}
          stroke="none"
          className={`opacity-0 ${shouldAnimate ? "animate-fade-in" : ""}`}
          style={{ animationDelay: "0.2s" }}
        />

        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength}
          className={shouldAnimate ? "animate-draw" : ""}
        />

        {points.map(([x, y], i) => (
          <g key={i} className="group">
            <circle
              cx={x}
              cy={y}
              r="4"
              fill="white"
              stroke={color}
              strokeWidth="2"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-crosshair"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export const PerformanceRadar = ({ data, size = 200, color = "#3b82f6" }) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!data || data.length < 3) return null;

  const center = size / 2;
  const radius = (size / 2) * 0.65;
  const angleSlice = 360 / data.length;

  const levels = [0.33, 0.66, 1];
  const webs = levels.map((level, i) => {
    const points = data
      .map((_, index) => {
        const { x, y } = polarToCartesian(
          center,
          center,
          radius * level,
          index * angleSlice,
        );
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <polygon
        key={i}
        points={points}
        fill="none"
        stroke="#27272a"
        strokeWidth="1"
      />
    );
  });

  const axes = data.map((stat, i) => {
    const { x, y } = polarToCartesian(center, center, radius, i * angleSlice);
    return (
      <line
        key={i}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="#27272a"
        strokeWidth="1"
      />
    );
  });

  const labels = data.map((stat, i) => {
    const labelRadius = radius * 1.35;
    const { x, y } = polarToCartesian(
      center,
      center,
      labelRadius,
      i * angleSlice,
    );
    return (
      <text
        key={i}
        x={x}
        y={y}
        dy="0.35em"
        textAnchor="middle"
        className="text-[10px] fill-zinc-500 font-bold uppercase tracking-widest"
      >
        {stat.label}
      </text>
    );
  });

  const dataPointsString = data
    .map((stat, i) => {
      const ratio = Math.min(1, Math.max(0, stat.value / stat.max));
      const r = shouldAnimate ? radius * ratio : 0;
      const { x, y } = polarToCartesian(center, center, r, i * angleSlice);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex justify-center items-center relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g>
          {webs}
          {axes}
          <polygon
            points={dataPointsString}
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="2"
            className="transition-all duration-1000 ease-out"
          />
          {/* Data Points (Dots) */}
          {data.map((stat, i) => {
            const ratio = Math.min(1, Math.max(0, stat.value / stat.max));
            const r = shouldAnimate ? radius * ratio : 0;
            const { x, y } = polarToCartesian(
              center,
              center,
              r,
              i * angleSlice,
            );
            const isHovered = hoveredIndex === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Visible dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3}
                  fill={isHovered ? "#fff" : color}
                  stroke={isHovered ? color : "none"}
                  strokeWidth="2"
                  className="transition-all duration-300 ease-out"
                />
                {/* Invisible larger hit target */}
                <circle cx={x} cy={y} r={10} fill="transparent" />
              </g>
            );
          })}
          {labels}
        </g>
      </svg>

      {/* Floating Tooltip */}
      {hoveredIndex !== null &&
        (() => {
          const stat = data[hoveredIndex];
          const ratio = Math.min(1, Math.max(0, stat.value / stat.max));
          const r = radius * ratio;
          const { x, y } = polarToCartesian(
            center,
            center,
            r,
            hoveredIndex * angleSlice,
          );

          // Determine offsets to keep tooltip inside bounds
          // const xOffset = x > center ? 10 : -10;
          // const yOffset = y > center ? 10 : -35;
          // const align = x > center ? "left" : "right";

          return (
            <div
              className="absolute pointer-events-none bg-zinc-800/90 backdrop-blur border border-zinc-600 px-2 py-1 rounded shadow-xl z-50 whitespace-nowrap"
              style={{
                left: x,
                top: y,
                transform: `translate(${x > center ? "10px" : "-100%"}, ${y > center ? "10px" : "-120%"})`,
              }}
            >
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-zinc-400 uppercase font-bold">
                  {stat.label}
                </span>
                <span className="text-xs font-bold text-white">
                  {stat.value}
                </span>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
