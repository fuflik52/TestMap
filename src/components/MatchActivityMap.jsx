import { useEffect, useMemo, useRef } from "react";

function drawHeatmap(canvas, points, deaths) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (!points || points.length === 0) return;

  ctx.globalCompositeOperation = "lighter";

  const radius = Math.max(10, Math.round(Math.min(width, height) * 0.03));
  for (const p of points) {
    if (p == null) continue;
    const x = p.u * width;
    const y = (1 - p.v) * height;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, "rgba(255, 255, 0, 0.08)");
    g.addColorStop(0.4, "rgba(255, 80, 0, 0.06)");
    g.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";

  if (deaths && deaths.length > 0) {
    for (const d of deaths) {
      const x = d.u * width;
      const y = (1 - d.v) * height;
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

export default function MatchActivityMap({ activity, apiBase }) {
  const canvasRef = useRef(null);
  const points = useMemo(() => activity?.samples ?? [], [activity]);
  const deaths = useMemo(() => activity?.deaths ?? [], [activity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = Math.max(300, Math.floor(rect?.width ?? 800));
      const h = w;
      canvas.width = w;
      canvas.height = h;
      drawHeatmap(canvas, points, deaths);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [points, deaths]);

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
            src={mapUrl}
            alt="Map"
            className="w-full h-auto block"
            onLoad={() => {
              const c = canvasRef.current;
              if (c) drawHeatmap(c, points, deaths);
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
