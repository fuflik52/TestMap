import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getGridLetter(i) {
  let n = i + 1;
  let text = "";
  while (n > 0) {
    n -= 1;
    text = String.fromCharCode(65 + (n % 26)) + text;
    n = Math.floor(n / 26);
  }
  return text;
}

function worldToUv(val, worldSize, mapScale, margin) {
  const mapPixelSize = worldSize * mapScale + margin * 2;
  return (margin + (val + worldSize / 2) * mapScale) / mapPixelSize;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ─── Draw all overlays onto canvas ─── */
function drawOverlays(canvas, activity, points, deaths, layers) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const worldSize = Number(activity?.worldSize);
  const mapScale = Number(activity?.mapScale ?? 0.5);
  const margin = Number(activity?.margin ?? 500);

  /* ─── GRID ─── */
  if (layers.grid && Number.isFinite(worldSize) && worldSize > 0) {
    const cellSizeBase = 146.28572;
    const gridCells = Math.max(
      1,
      Math.floor(worldSize / cellSizeBase + 0.001)
    );
    const cellSize = worldSize / gridCells;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";

    for (let i = 1; i < gridCells; i++) {
      const u = worldToUv(
        -worldSize / 2 + i * cellSize,
        worldSize,
        mapScale,
        margin
      );
      const x = u * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 1; i < gridCells; i++) {
      const v = worldToUv(
        worldSize / 2 - i * cellSize,
        worldSize,
        mapScale,
        margin
      );
      const y = (1 - v) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.max(
      9,
      Math.floor(Math.min(width, height) * 0.015)
    )}px sans-serif`;

    for (let x = 0; x < gridCells; x++) {
      for (let y = 0; y < gridCells; y++) {
        const u = worldToUv(
          -worldSize / 2 + x * cellSize + cellSize / 2,
          worldSize,
          mapScale,
          margin
        );
        const v = worldToUv(
          worldSize / 2 - y * cellSize - cellSize / 2,
          worldSize,
          mapScale,
          margin
        );
        ctx.fillText(
          `${getGridLetter(x)}${y}`,
          u * width,
          (1 - v) * height
        );
      }
    }
    ctx.restore();
  }

  /* ─── HEATMAP (Positions layer) ─── */
  if (layers.positions && points.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const radius = Math.max(
      14,
      Math.round(Math.min(width, height) * 0.04)
    );

    for (const p of points) {
      if (!p) continue;
      const u = Number(p.u);
      const v = Number(p.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const x = u * width;
      const y = (1 - v) * height;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, "rgba(0,255,120,0.13)");
      g.addColorStop(0.25, "rgba(180,255,0,0.09)");
      g.addColorStop(0.5, "rgba(255,200,0,0.05)");
      g.addColorStop(0.8, "rgba(255,60,0,0.02)");
      g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ─── ROUTE PATH (Kills layer) ─── */
  if (layers.kills && points.length > 1) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.25;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (!a || !b) continue;
      const progress = i / points.length;
      const r = Math.min(
        255,
        Math.floor(clamp(progress * 2, 0, 1) * 255)
      );
      const g = Math.min(
        255,
        Math.floor(clamp(1 - progress, 0, 1) * 2 * 255)
      );
      ctx.strokeStyle = `rgb(${r},${g},80)`;
      ctx.beginPath();
      ctx.moveTo(a.u * width, (1 - a.v) * height);
      ctx.lineTo(b.u * width, (1 - b.v) * height);
      ctx.stroke();
    }

    // Main line
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2.5;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (!a || !b) continue;
      const progress = i / points.length;
      const r = Math.min(
        255,
        Math.floor(clamp(progress * 2, 0, 1) * 255)
      );
      const g = Math.min(
        255,
        Math.floor(clamp(1 - progress, 0, 1) * 2 * 255)
      );
      ctx.strokeStyle = `rgb(${r},${g},60)`;
      ctx.beginPath();
      ctx.moveTo(a.u * width, (1 - a.v) * height);
      ctx.lineTo(b.u * width, (1 - b.v) * height);
      ctx.stroke();
    }

    // Start marker (green dot)
    const s0 = points[0];
    if (s0) {
      ctx.globalAlpha = 1;
      const sx = s0.u * width,
        sy = (1 - s0.v) * height;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // End marker (red dot)
    const sE = points[points.length - 1];
    if (sE) {
      ctx.globalAlpha = 1;
      const ex = sE.u * width,
        ey = (1 - sE.v) * height;
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ─── DEATH MARKERS ─── */
  if (layers.deaths && deaths.length > 0) {
    ctx.save();
    const pinH = Math.max(22, Math.min(width, height) * 0.045);

    for (const d of deaths) {
      const u = Number(d.u);
      const v = Number(d.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const x = u * width;
      const y = (1 - v) * height;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + 3, pinH * 0.25, pinH * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pin body
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x - pinH * 0.4,
        y - pinH * 0.55,
        x - pinH * 0.5,
        y - pinH * 0.95,
        x,
        y - pinH
      );
      ctx.bezierCurveTo(
        x + pinH * 0.5,
        y - pinH * 0.95,
        x + pinH * 0.4,
        y - pinH * 0.55,
        x,
        y
      );
      ctx.closePath();
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Skull head circle
      const skullY = y - pinH * 0.68;
      const skullR = pinH * 0.24;
      ctx.beginPath();
      ctx.arc(x, skullY, skullR, 0, Math.PI * 2);
      ctx.fillStyle = "#fef2f2";
      ctx.fill();

      // Eyes
      ctx.fillStyle = "#450a0a";
      const eyeR = skullR * 0.28;
      ctx.beginPath();
      ctx.arc(
        x - skullR * 0.38,
        skullY - skullR * 0.08,
        eyeR,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        x + skullR * 0.38,
        skullY - skullR * 0.08,
        eyeR,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Mouth
      ctx.strokeStyle = "#450a0a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - skullR * 0.25, skullY + skullR * 0.4);
      ctx.lineTo(x + skullR * 0.25, skullY + skullR * 0.4);
      ctx.stroke();
      // Teeth
      for (let ti = -1; ti <= 1; ti++) {
        const tx = x + ti * skullR * 0.15;
        ctx.beginPath();
        ctx.moveTo(tx, skullY + skullR * 0.32);
        ctx.lineTo(tx, skullY + skullR * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ─── Clamp pan so map stays in viewport ─── */
function clampPan(px, py, zoom, cw, ch) {
  if (zoom <= 1) return { x: 0, y: 0 };
  const minX = -(cw * (zoom - 1));
  const minY = -(ch * (zoom - 1));
  return {
    x: clamp(px, minX, 0),
    y: clamp(py, minY, 0),
  };
}

/* ═══════════════════════════════════════════════════ */
export default function MatchActivityMap({ activity, apiBase }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layers, setLayers] = useState({
    grid: true,
    positions: true,
    kills: true,
    deaths: true,
    entities: true,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef(null);

  const points = useMemo(() => activity?.samples ?? [], [activity]);
  const deaths = useMemo(() => activity?.deaths ?? [], [activity]);

  /* ─── Sync canvas size & redraw ─── */
  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imgRef.current;
    const w = img?.offsetWidth || 800;
    const h = img?.offsetHeight || w;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    drawOverlays(canvas, activity, points, deaths, layers);
  }, [activity, points, deaths, layers]);

  useEffect(() => {
    syncCanvas();
  }, [syncCanvas, imgLoaded]);

  useEffect(() => {
    const onResize = () => syncCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncCanvas]);

  /* ─── Wheel zoom (centred on cursor) ─── */
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const mapX = (cx - pan.x) / zoom;
      const mapY = (cy - pan.y) / zoom;

      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const newZoom = clamp(zoom * factor, 1, 14);
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const np = clampPan(
        cx - mapX * newZoom,
        cy - mapY * newZoom,
        newZoom,
        cw,
        ch
      );

      setZoom(newZoom);
      setPan(np);
    },
    [zoom, pan]
  );

  /* ─── Drag to pan ─── */
  const handleMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      dragRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      e.preventDefault();
    },
    [pan]
  );

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const container = containerRef.current;
      if (!container) return;
      const np = clampPan(
        d.px + (e.clientX - d.sx),
        d.py + (e.clientY - d.sy),
        zoom,
        container.clientWidth,
        container.clientHeight
      );
      setPan(np);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [zoom]);

  /* ─── Touch support (pinch & drag) ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastTouchDist = 0;
    let lastTouchCenter = null;
    let touchPanStart = null;

    const getCenter = (t1, t2) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });
    const getDist = (t1, t2) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchPanStart = {
          sx: e.touches[0].clientX,
          sy: e.touches[0].clientY,
          px: pan.x,
          py: pan.y,
        };
      } else if (e.touches.length === 2) {
        lastTouchDist = getDist(e.touches[0], e.touches[1]);
        lastTouchCenter = getCenter(e.touches[0], e.touches[1]);
        touchPanStart = null;
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && touchPanStart) {
        const np = clampPan(
          touchPanStart.px + (e.touches[0].clientX - touchPanStart.sx),
          touchPanStart.py + (e.touches[0].clientY - touchPanStart.sy),
          zoom,
          container.clientWidth,
          container.clientHeight
        );
        setPan(np);
      } else if (e.touches.length === 2 && lastTouchCenter) {
        const newDist = getDist(e.touches[0], e.touches[1]);
        const scale = newDist / lastTouchDist;
        const newZoom = clamp(zoom * scale, 1, 14);
        lastTouchDist = newDist;

        const rect = container.getBoundingClientRect();
        const center = getCenter(e.touches[0], e.touches[1]);
        const cx = center.x - rect.left;
        const cy = center.y - rect.top;
        const mapX = (cx - pan.x) / zoom;
        const mapY = (cy - pan.y) / zoom;
        const np = clampPan(
          cx - mapX * newZoom,
          cy - mapY * newZoom,
          newZoom,
          container.clientWidth,
          container.clientHeight
        );
        setZoom(newZoom);
        setPan(np);
        lastTouchCenter = center;
      }
    };

    const onTouchEnd = () => {
      touchPanStart = null;
      lastTouchCenter = null;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [zoom, pan]);

  /* ─── Helpers ─── */
  const zoomTo = useCallback(
    (factor) => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const cx = cw / 2;
      const cy = ch / 2;
      const mapX = (cx - pan.x) / zoom;
      const mapY = (cy - pan.y) / zoom;
      const newZoom = clamp(zoom * factor, 1, 14);
      const np = clampPan(
        cx - mapX * newZoom,
        cy - mapY * newZoom,
        newZoom,
        cw,
        ch
      );
      setZoom(newZoom);
      setPan(np);
    },
    [zoom, pan]
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const mapUrl = activity?.mapPngUrl
    ? `${apiBase}${activity.mapPngUrl}`
    : null;

  /* ─── No activity data ─── */
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

  /* ─── Layer definitions ─── */
  const layerDefs = [
    { key: "grid", label: "Grid", accent: "#3b82f6" },
    { key: "positions", label: "Heatmap", accent: "#22c55e" },
    { key: "kills", label: "Route", accent: "#f59e0b" },
    { key: "deaths", label: "Deaths", accent: "#ef4444" },
    { key: "entities", label: "Entities", accent: "#8b5cf6" },
  ];

  return (
    <div
      className={`${
        fullscreen
          ? "fixed inset-0 z-50 bg-[#09090b] p-4 flex flex-col"
          : "dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-4"
      }`}
    >
      {/* ─── Layer toggles ─── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        {layerDefs.map(({ key, label, accent }) => (
          <label
            key={key}
            className="flex items-center gap-1.5 cursor-pointer select-none group"
          >
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: accent }}
            />
            <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-wide">
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* ─── Info bar ─── */}
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="text-[11px] text-zinc-500">
          Сэмплов: <span className="font-mono">{points.length}</span>
          {deaths.length > 0 && (
            <>
              {" · Смертей: "}
              <span className="font-mono text-red-400">{deaths.length}</span>
            </>
          )}
          {activity.playerName && (
            <>
              {" · Игрок: "}
              <span className="font-mono text-zinc-300">
                {activity.playerName}
              </span>
            </>
          )}
        </div>
        <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-500 select-none">
          {activity.id}
        </div>
      </div>

      {/* ─── Map container ─── */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl border dark:border-zinc-700 border-zinc-300 select-none ${
          fullscreen ? "flex-1" : "w-full max-w-[900px] mx-auto"
        }`}
        style={{
          background: "#0a0a0a",
          cursor: dragRef.current ? "grabbing" : "grab",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        {/* Transformed wrapper */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "relative",
            width: "fit-content",
          }}
        >
          {mapUrl ? (
            <img
              ref={imgRef}
              src={mapUrl}
              alt="Map"
              draggable={false}
              className="block"
              style={{
                maxWidth: fullscreen ? "calc(100vh - 140px)" : "900px",
                width: "100%",
              }}
              onLoad={() => {
                setImgLoaded(true);
                setTimeout(syncCanvas, 50);
              }}
            />
          ) : (
            <div
              ref={imgRef}
              className="grid place-items-center text-sm text-zinc-600"
              style={{
                width: fullscreen ? "calc(100vh - 140px)" : "900px",
                aspectRatio: "1",
                background:
                  "radial-gradient(ellipse at center, #1a2a1a 0%, #0a0a0a 70%)",
              }}
            >
              <div className="text-center">
                <div className="text-zinc-500 text-lg mb-1">🗺️</div>
                <div>Карта не загружена</div>
                <div className="text-[10px] text-zinc-700 mt-1">
                  Данные активности показаны поверх
                </div>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* ─── Fullscreen toggle ─── */}
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg w-9 h-9 flex items-center justify-center text-base transition-all border border-white/10"
          title={fullscreen ? "Выйти" : "На весь экран"}
        >
          {fullscreen ? "✕" : "⛶"}
        </button>

        {/* ─── Zoom controls ─── */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button
            onClick={() => zoomTo(1.4)}
            className="bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg w-9 h-9 flex items-center justify-center text-xl font-bold transition-all border border-white/10"
          >
            +
          </button>
          <button
            onClick={() => zoomTo(1 / 1.4)}
            className="bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg w-9 h-9 flex items-center justify-center text-xl font-bold transition-all border border-white/10"
          >
            −
          </button>
          {zoom > 1.05 && (
            <button
              onClick={resetView}
              className="bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg w-9 h-9 flex items-center justify-center text-[10px] font-bold tracking-tight transition-all border border-white/10 mt-1"
              title="Сбросить"
            >
              1:1
            </button>
          )}
        </div>

        {/* ─── Zoom indicator ─── */}
        {zoom > 1.05 && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/50 backdrop-blur-sm text-white text-[11px] font-mono px-2.5 py-1 rounded-lg border border-white/10">
            {zoom.toFixed(1)}×
          </div>
        )}

        {/* ─── Legend ─── */}
        {zoom <= 1.05 && points.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              Старт
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ml-2" />
              Конец
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
