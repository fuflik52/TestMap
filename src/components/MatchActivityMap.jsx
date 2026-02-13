import { useEffect, useMemo, useRef } from "react";

function getGridLetter(i) {
  let n = i + 1;
  let text = "";
  while (n > 0) {
    n -= 1;
    text = String.fromCharCode("A".charCodeAt(0) + (n % 26)) + text;
    n = Math.floor(n / 26);
  }
  return text;
}

function worldToUv(val, worldSize, mapScale, margin) {
  const mapPixelSize = worldSize * mapScale + margin * 2;
  return (margin + (val + worldSize / 2) * mapScale) / mapPixelSize;
}

function drawOverlay(canvas, activity, points, deaths) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  // 1) Heatmap
  if (points && points.length > 0) {
    ctx.globalCompositeOperation = "lighter";

    const radius = Math.max(10, Math.round(Math.min(width, height) * 0.03));
    for (const p of points) {
      if (p == null) continue;
      const u = Number(p.u);
      const v = Number(p.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const x = u * width;
      const y = (1 - v) * height;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      // Slightly stronger alpha so it is visible on most map styles
      g.addColorStop(0, "rgba(255, 255, 0, 0.14)");
      g.addColorStop(0.4, "rgba(255, 80, 0, 0.10)");
      g.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";

    if (deaths && deaths.length > 0) {
      for (const d of deaths) {
        const u = Number(d.u);
        const v = Number(d.v);
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
        const x = u * width;
        const y = (1 - v) * height;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(4, radius * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.stroke();
      }
    }
  }

  // 2) Grid overlay (always, if we have worldSize)
  const worldSize = Number(activity?.worldSize);
  if (!Number.isFinite(worldSize) || worldSize <= 0) return;

  const mapScale = Number(activity?.mapScale ?? 0.5);
  const margin = Number(activity?.margin ?? 500);

  const cellSizeBase = 146.28572;
  const gridCells = Math.max(1, Math.floor(worldSize / cellSizeBase + 0.001));
  const cellSize = worldSize / gridCells;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";

  // Lines
  for (let i = 1; i < gridCells; i++) {
    const wx = -worldSize / 2 + i * cellSize;
    const u = worldToUv(wx, worldSize, mapScale, margin);
    const x = u * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let i = 1; i < gridCells; i++) {
    const wz = worldSize / 2 - i * cellSize;
    const v = worldToUv(wz, worldSize, mapScale, margin);
    const y = (1 - v) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, Math.floor(Math.min(width, height) * 0.018))}px sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  for (let x = 0; x < gridCells; x++) {
    for (let y = 0; y < gridCells; y++) {
      const wx = -worldSize / 2 + x * cellSize + cellSize / 2;
      const wz = worldSize / 2 - y * cellSize - cellSize / 2;
      const u = worldToUv(wx, worldSize, mapScale, margin);
      const v = worldToUv(wz, worldSize, mapScale, margin);
      const px = u * width;
      const py = (1 - v) * height;
      const label = `${getGridLetter(x)}${y}`;
      ctx.fillText(label, px, py);
    }
  }
  ctx.restore();
}

export default function MatchActivityMap({ activity, apiBase }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const points = useMemo(() => activity?.samples ?? [], [activity]);
  const deaths = useMemo(() => activity?.deaths ?? [], [activity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = imgRef.current;

    const resize = () => {
      const rect = img?.getBoundingClientRect() ?? canvas.parentElement?.getBoundingClientRect();
      const w = Math.max(300, Math.floor(rect?.width ?? 800));
      const h = Math.max(300, Math.floor(rect?.height ?? w));
      canvas.width = w;
      canvas.height = h;
      drawOverlay(canvas, activity, points, deaths);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [activity, points, deaths]);

  if (!activity) {
    return (
      <div className="dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
          Activity Map
        </div>
        <div className="text-sm text-zinc-500 mt-2">
          Нет данных активности для этого матча.
        </div>
      </div>
    );
  }

  const mapUrl = activity?.mapPngUrl
    ? `${apiBase}${activity.mapPngUrl}`
    : null;

  return (
    <div className="dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Activity Map
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Сэмплов: <span className="font-mono">{points.length}</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-500 select-none">
          {activity.id}
        </div>
      </div>

      <div className="mt-4 relative w-full max-w-[700px] mx-auto rounded-xl overflow-hidden border dark:border-zinc-800 border-zinc-200">
        {mapUrl ? (
          <img
            ref={imgRef}
            src={mapUrl}
            alt="Map"
            className="w-full h-auto block"
            onLoad={() => {
              const c = canvasRef.current;
              if (c) drawOverlay(c, activity, points, deaths);
            }}
          />
        ) : (
          <div className="aspect-square w-full grid place-items-center text-sm text-zinc-500">
            Карта недоступна
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}
