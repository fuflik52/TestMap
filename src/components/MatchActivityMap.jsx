import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ─── helpers ─── */
function getGridLetter(i) {
  let n = i + 1, t = "";
  while (n > 0) { n--; t = String.fromCharCode(65 + (n % 26)) + t; n = Math.floor(n / 26); }
  return t;
}
function worldToUv(val, ws, sc, m) {
  return (m + (val + ws / 2) * sc) / (ws * sc + m * 2);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ─── Smooth heatmap drawing ─── */
function drawHeatmap(canvas, points) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!points || points.length === 0) return;

  const r = Math.max(30, Math.round(Math.min(W, H) * 0.06));

  // 1. Draw alpha blobs (grayscale intensity)
  ctx.globalCompositeOperation = "source-over";
  for (const p of points) {
    if (!p) continue;
    const u = Number(p.u), v = Number(p.v);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    const x = u * W, y = (1 - v) * H;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.045)");
    g.addColorStop(0.5, "rgba(0,0,0,0.015)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Recolor: map alpha intensity → gradient palette
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  // Palette: 256 colors, blue→cyan→green→yellow→red
  const palette = buildHeatPalette();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]; // alpha = intensity
    if (a < 2) { d[i] = d[i+1] = d[i+2] = d[i+3] = 0; continue; }
    const idx = Math.min(255, a) * 4;
    d[i]     = palette[idx];
    d[i + 1] = palette[idx + 1];
    d[i + 2] = palette[idx + 2];
    d[i + 3] = Math.min(255, Math.round(a * 1.8));
  }
  ctx.putImageData(imgData, 0, 0);
}

function buildHeatPalette() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0,    "rgba(0,0,255,0)");    // transparent blue (low)
  g.addColorStop(0.1,  "rgba(0,100,255,1)");  // blue
  g.addColorStop(0.25, "rgba(0,200,200,1)");  // cyan
  g.addColorStop(0.4,  "rgba(0,220,0,1)");    // green
  g.addColorStop(0.6,  "rgba(180,255,0,1)");  // yellow-green
  g.addColorStop(0.75, "rgba(255,220,0,1)");  // yellow
  g.addColorStop(0.9,  "rgba(255,100,0,1)");  // orange
  g.addColorStop(1,    "rgba(255,0,0,1)");     // red
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

/* ─── Route drawing ─── */
function drawRoute(canvas, points) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!points || points.length < 2) return;

  const coords = [];
  for (const p of points) {
    if (!p) continue;
    const u = Number(p.u), v = Number(p.v);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    coords.push({ x: u * W, y: (1 - v) * H });
  }
  if (coords.length < 2) return;

  // Downsample
  const maxPts = 300;
  let pts = coords;
  if (coords.length > maxPts) {
    const step = coords.length / maxPts;
    pts = [];
    for (let i = 0; i < maxPts; i++) pts.push(coords[Math.floor(i * step)]);
    pts.push(coords[coords.length - 1]);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer glow
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Main line — gradient segments
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2.5;
  for (let i = 1; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    // hue: 120 (green) → 60 (yellow) → 0 (red)
    const h = Math.round(120 * (1 - t));
    ctx.strokeStyle = `hsl(${h}, 90%, 50%)`;
    ctx.beginPath();
    ctx.moveTo(pts[i-1].x, pts[i-1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ─── Grid drawing ─── */
function drawGrid(canvas, activity) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const worldSize = Number(activity?.worldSize);
  const mapScale = Number(activity?.mapScale ?? 0.5);
  const margin = Number(activity?.margin ?? 500);
  if (!Number.isFinite(worldSize) || worldSize <= 0) return;

  const base = 146.28572;
  const cells = Math.max(1, Math.floor(worldSize / base + 0.001));
  const cs = worldSize / cells;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";

  for (let i = 0; i <= cells; i++) {
    const u = worldToUv(-worldSize / 2 + i * cs, worldSize, mapScale, margin);
    ctx.beginPath(); ctx.moveTo(u * W, 0); ctx.lineTo(u * W, H); ctx.stroke();
  }
  for (let i = 0; i <= cells; i++) {
    const v = worldToUv(worldSize / 2 - i * cs, worldSize, mapScale, margin);
    ctx.beginPath(); ctx.moveTo(0, (1 - v) * H); ctx.lineTo(W, (1 - v) * H); ctx.stroke();
  }

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.max(9, Math.floor(Math.min(W, H) * 0.016));
  ctx.font = `bold ${fs}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

  for (let x = 0; x < cells; x++) {
    for (let y = 0; y < cells; y++) {
      const u = worldToUv(-worldSize / 2 + x * cs + cs / 2, worldSize, mapScale, margin);
      const v = worldToUv(worldSize / 2 - y * cs - cs / 2, worldSize, mapScale, margin);
      ctx.fillText(`${getGridLetter(x)}${y}`, u * W, (1 - v) * H);
    }
  }
  ctx.restore();
}

/* ─── Pan clamping ─── */
function clampPan(px, py, zoom, cw, ch) {
  if (zoom <= 1) return { x: 0, y: 0 };
  return {
    x: clamp(px, -(cw * (zoom - 1)), 0),
    y: clamp(py, -(ch * (zoom - 1)), 0),
  };
}

/* ─── Skull SVG as data URI ─── */
const skullSvg = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C6.48 2 2 6.48 2 12c0 2.5.92 4.77 2.44 6.52L4 22h4l.5-2h7l.5 2h4l-.44-3.48A9.96 9.96 0 0022 12c0-5.52-4.48-10-10-10zm-3 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>`)}`;

/* ─── Death Pin Component ─── */
function DeathPin({ x, y, index, type = "death" }) {
  const isKill = type === "kill";
  const bg = isKill ? "#2563eb" : "#dc2626";
  const border = isKill ? "#1d4ed8" : "#991b1b";

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x * 100}%`,
        bottom: `${y * 100}%`,
        transform: "translate(-50%, 0)",
        zIndex: 20,
      }}
    >
      {/* Pin container */}
      <div className="relative flex flex-col items-center" style={{ marginBottom: "-2px" }}>
        {/* Pin head */}
        <div
          className="relative flex items-center justify-center rounded-lg shadow-lg"
          style={{
            width: 36,
            height: 36,
            backgroundColor: bg,
            border: `2px solid ${border}`,
            borderRadius: 8,
            boxShadow: `0 2px 8px ${bg}66, 0 4px 16px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Skull icon */}
          <img src={skullSvg("#fff")} alt="" style={{ width: 22, height: 22, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }} />
          {/* Number badge */}
          {index != null && (
            <div
              className="absolute -top-2 -right-2 flex items-center justify-center rounded-full text-white font-bold shadow"
              style={{
                width: 16, height: 16, fontSize: 9,
                backgroundColor: "#18181b",
                border: `1.5px solid ${bg}`,
              }}
            >
              {index}
            </div>
          )}
        </div>
        {/* Pin stem */}
        <div style={{
          width: 2,
          height: 10,
          background: `linear-gradient(to bottom, ${bg}, ${border})`,
          borderRadius: 1,
        }} />
        {/* Pin tip */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: border,
          boxShadow: `0 1px 3px rgba(0,0,0,0.4)`,
          marginTop: -1,
        }} />
      </div>
    </div>
  );
}

/* ═══════ COMPONENT ═══════ */
export default function MatchActivityMap({ activity, apiBase }) {
  const containerRef = useRef(null);
  const heatCanvasRef = useRef(null);
  const routeCanvasRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const imgRef = useRef(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [, forceRender] = useState(0);
  const [layers, setLayers] = useState({
    grid: true,
    heatmap: true,
    route: true,
    deaths: true,
    kills: false,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef(null);

  const points = useMemo(() => activity?.samples ?? [], [activity]);
  const deaths = useMemo(() => activity?.deaths ?? [], [activity]);

  const setZoom = useCallback((z) => { zoomRef.current = z; forceRender((n) => n + 1); }, []);
  const setPan = useCallback((p) => { panRef.current = p; forceRender((n) => n + 1); }, []);
  const zoom = zoomRef.current;
  const pan = panRef.current;

  /* ─── Size helper ─── */
  const getSize = useCallback(() => {
    const img = imgRef.current;
    const w = img?.offsetWidth || 800;
    const h = img?.offsetHeight || w;
    return { w, h };
  }, []);

  /* ─── Redraw all canvases ─── */
  const syncAll = useCallback(() => {
    const { w, h } = getSize();

    [heatCanvasRef, routeCanvasRef, gridCanvasRef].forEach((ref) => {
      const c = ref.current;
      if (!c) return;
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    });

    if (gridCanvasRef.current) drawGrid(gridCanvasRef.current, activity);
    if (heatCanvasRef.current) drawHeatmap(heatCanvasRef.current, points);
    if (routeCanvasRef.current) drawRoute(routeCanvasRef.current, points);
  }, [activity, points, getSize]);

  useEffect(() => { syncAll(); }, [syncAll, imgLoaded]);
  useEffect(() => {
    const fn = () => syncAll();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [syncAll]);

  /* ─── WHEEL (non-passive) ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const z = zoomRef.current, p = panRef.current;
      const mx = (cx - p.x) / z, my = (cy - p.y) / z;
      const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
      const nz = clamp(z * factor, 1, 20);
      const np = clampPan(cx - mx * nz, cy - my * nz, nz, container.clientWidth, container.clientHeight);
      zoomRef.current = nz; panRef.current = np; forceRender((n) => n + 1);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  /* ─── DRAG ─── */
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const c = containerRef.current;
      if (!c) return;
      const np = clampPan(d.px + (e.clientX - d.sx), d.py + (e.clientY - d.sy), zoomRef.current, c.clientWidth, c.clientHeight);
      panRef.current = np; forceRender((n) => n + 1);
    };
    const onUp = () => { dragRef.current = null; forceRender((n) => n + 1); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  /* ─── TOUCH (non-passive) ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastDist = 0, lastCenter = null, tpStart = null;
    const gc = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    const gd = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTS = (e) => {
      if (e.touches.length === 1) tpStart = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, px: panRef.current.x, py: panRef.current.y };
      else if (e.touches.length === 2) { lastDist = gd(e.touches[0], e.touches[1]); lastCenter = gc(e.touches[0], e.touches[1]); tpStart = null; }
    };
    const onTM = (e) => {
      e.preventDefault();
      const c = container;
      if (e.touches.length === 1 && tpStart) {
        const np = clampPan(tpStart.px + (e.touches[0].clientX - tpStart.sx), tpStart.py + (e.touches[0].clientY - tpStart.sy), zoomRef.current, c.clientWidth, c.clientHeight);
        panRef.current = np; forceRender((n) => n + 1);
      } else if (e.touches.length === 2 && lastCenter) {
        const nd = gd(e.touches[0], e.touches[1]);
        const nz = clamp(zoomRef.current * (nd / lastDist), 1, 20);
        lastDist = nd;
        const rect = c.getBoundingClientRect();
        const center = gc(e.touches[0], e.touches[1]);
        const cx2 = center.x - rect.left, cy2 = center.y - rect.top;
        const mx = (cx2 - panRef.current.x) / zoomRef.current, my = (cy2 - panRef.current.y) / zoomRef.current;
        const np = clampPan(cx2 - mx * nz, cy2 - my * nz, nz, c.clientWidth, c.clientHeight);
        zoomRef.current = nz; panRef.current = np; forceRender((n) => n + 1);
        lastCenter = center;
      }
    };
    const onTE = () => { tpStart = null; lastCenter = null; };
    container.addEventListener("touchstart", onTS, { passive: false });
    container.addEventListener("touchmove", onTM, { passive: false });
    container.addEventListener("touchend", onTE);
    return () => { container.removeEventListener("touchstart", onTS); container.removeEventListener("touchmove", onTM); container.removeEventListener("touchend", onTE); };
  }, []);

  /* ─── zoom helpers ─── */
  const zoomTo = useCallback((factor) => {
    const c = containerRef.current; if (!c) return;
    const cw = c.clientWidth, ch = c.clientHeight, cx = cw / 2, cy = ch / 2;
    const z = zoomRef.current, p = panRef.current;
    const mx = (cx - p.x) / z, my = (cy - p.y) / z;
    const nz = clamp(z * factor, 1, 20);
    const np = clampPan(cx - mx * nz, cy - my * nz, nz, cw, ch);
    setZoom(nz); setPan(np);
  }, [setZoom, setPan]);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [setZoom, setPan]);

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const mapUrl = activity?.mapPngUrl ? `${apiBase}${activity.mapPngUrl}` : null;

  /* ─── empty ─── */
  if (!activity) {
    return (
      <div className="dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-5">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Activity Map</div>
        <div className="text-sm text-zinc-500 mt-2">Нет данных активности для этого матча.</div>
      </div>
    );
  }

  const layerDefs = [
    { key: "grid",    label: "Grid",    color: "#3b82f6" },
    { key: "heatmap", label: "Heatmap", color: "#22c55e" },
    { key: "route",   label: "Route",   color: "#f59e0b" },
    { key: "deaths",  label: "Deaths",  color: "#ef4444" },
    { key: "kills",   label: "Kills",   color: "#2563eb" },
  ];

  const canvasStyle = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" };

  return (
    <div className={fullscreen
      ? "fixed inset-0 z-50 bg-[#09090b]/95 backdrop-blur-sm p-4 flex flex-col animate-in fade-in duration-200"
      : "dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-4"}>

      {/* ─── Layer toggles ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        {layerDefs.map(({ key, label, color }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none group">
            <div
              onClick={() => toggleLayer(key)}
              className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: layers[key] ? color : "transparent",
                border: `2px solid ${layers[key] ? color : "#52525b"}`,
              }}
            >
              {layers[key] && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-wide">
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* ─── Info bar ─── */}
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="text-[11px] text-zinc-500">
          Сэмплов: <span className="font-mono text-zinc-400">{points.length}</span>
          {deaths.length > 0 && <>{" · Смертей: "}<span className="font-mono text-red-400">{deaths.length}</span></>}
          {activity.playerName && <>{" · "}<span className="font-mono text-zinc-300">{activity.playerName}</span></>}
        </div>
        <div className="text-[10px] font-mono text-zinc-600 select-none">{activity.id}</div>
      </div>

      {/* ─── Map ─── */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl border dark:border-zinc-700/50 border-zinc-300 select-none ${
          fullscreen ? "flex-1" : "w-full max-w-[900px] mx-auto"
        }`}
        style={{ background: "#0c0c0c", cursor: dragRef.current ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
      >
        <div style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: dragRef.current ? "none" : "transform 0.08s ease-out",
          position: "relative", width: "fit-content",
        }}>
          {/* Map image */}
          {mapUrl ? (
            <img ref={imgRef} src={mapUrl} alt="Map" draggable={false} className="block"
              style={{ maxWidth: fullscreen ? "calc(100vh - 140px)" : "900px", width: "100%" }}
              onLoad={() => { setImgLoaded(true); setTimeout(syncAll, 50); }}
              onError={() => setImgLoaded(true)} />
          ) : (
            <div ref={imgRef} className="grid place-items-center text-sm text-zinc-600"
              style={{
                width: fullscreen ? "calc(100vh - 140px)" : "900px", aspectRatio: "1",
                background: "radial-gradient(ellipse at center, #1a2a1a 0%, #0a0a0a 70%)",
              }}>
              <div className="text-center opacity-60">
                <div className="text-3xl mb-2">🗺️</div>
                <div className="text-zinc-400 text-sm">Карта не загружена</div>
                <div className="text-[10px] text-zinc-600 mt-1">Данные отображены поверх</div>
              </div>
            </div>
          )}

          {/* Grid canvas */}
          <canvas ref={gridCanvasRef} style={{ ...canvasStyle, opacity: layers.grid ? 1 : 0, transition: "opacity 0.2s" }} />

          {/* Heatmap canvas */}
          <canvas ref={heatCanvasRef} style={{ ...canvasStyle, opacity: layers.heatmap ? 0.85 : 0, transition: "opacity 0.2s" }} />

          {/* Route canvas */}
          <canvas ref={routeCanvasRef} style={{ ...canvasStyle, opacity: layers.route ? 1 : 0, transition: "opacity 0.2s" }} />

          {/* Death markers (HTML overlay) */}
          {layers.deaths && deaths.map((d, i) => {
            const u = Number(d.u), v = Number(d.v);
            if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
            return <DeathPin key={`death-${i}`} x={u} y={v} index={i + 1} type="death" />;
          })}

          {/* Kill markers (same as deaths but blue) */}
          {layers.kills && activity.kills && activity.kills.map((k, i) => {
            const u = Number(k.u), v = Number(k.v);
            if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
            return <DeathPin key={`kill-${i}`} x={u} y={v} index={i + 1} type="kill" />;
          })}
        </div>

        {/* ─── UI Controls ─── */}
        {/* Fullscreen */}
        <button onClick={() => setFullscreen((f) => !f)}
          className="absolute top-2.5 right-2.5 z-10 bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-sm transition-all border border-white/5 hover:border-white/15"
          title={fullscreen ? "Выйти" : "На весь экран"}>
          {fullscreen ? "✕" : "⛶"}
        </button>

        {/* Zoom */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button onClick={() => zoomTo(1.5)}
            className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-lg font-bold transition-all border border-white/5 hover:border-white/15">
            +
          </button>
          <button onClick={() => zoomTo(1 / 1.5)}
            className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-lg font-bold transition-all border border-white/5 hover:border-white/15">
            −
          </button>
          {zoom > 1.05 && (
            <button onClick={resetView}
              className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/60 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-[9px] font-bold transition-all border border-white/5 hover:border-white/15 mt-0.5">
              1:1
            </button>
          )}
        </div>

        {/* Zoom level */}
        {zoom > 1.05 && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/40 backdrop-blur text-white/60 text-[11px] font-mono px-2 py-0.5 rounded-md border border-white/5">
            {zoom.toFixed(1)}×
          </div>
        )}
      </div>
    </div>
  );
}
