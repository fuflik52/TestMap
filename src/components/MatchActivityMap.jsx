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
function lerp(a, b, t) { return a + (b - a) * t; }

/* colour helpers — HSL for smooth route gradient */
function hsl(h, s, l, a) { return `hsla(${h},${s}%,${l}%,${a})`; }

/* ─── smooth Catmull-Rom spline through points ─── */
function catmullRom(pts, steps) {
  if (pts.length < 2) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      out.push({ x, y, progress: (i * steps + s) / ((pts.length - 1) * steps) });
    }
  }
  out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, progress: 1 });
  return out;
}

/* ═══ DRAW ═══ */
function drawOverlays(canvas, activity, points, deaths, layers) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const worldSize = Number(activity?.worldSize);
  const mapScale  = Number(activity?.mapScale ?? 0.5);
  const margin    = Number(activity?.margin ?? 500);

  const toX = (u) => u * W;
  const toY = (v) => (1 - v) * H;

  /* ─── GRID ─── */
  if (layers.grid && Number.isFinite(worldSize) && worldSize > 0) {
    const base = 146.28572;
    const cells = Math.max(1, Math.floor(worldSize / base + 0.001));
    const cs = worldSize / cells;

    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";

    for (let i = 1; i < cells; i++) {
      const u = worldToUv(-worldSize / 2 + i * cs, worldSize, mapScale, margin);
      ctx.beginPath(); ctx.moveTo(u * W, 0); ctx.lineTo(u * W, H); ctx.stroke();
    }
    for (let i = 1; i < cells; i++) {
      const v = worldToUv(worldSize / 2 - i * cs, worldSize, mapScale, margin);
      ctx.beginPath(); ctx.moveTo(0, (1 - v) * H); ctx.lineTo(W, (1 - v) * H); ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fs = Math.max(8, Math.floor(Math.min(W, H) * 0.012));
    ctx.font = `600 ${fs}px -apple-system,BlinkMacSystemFont,sans-serif`;

    for (let x = 0; x < cells; x++) {
      for (let y = 0; y < cells; y++) {
        const u = worldToUv(-worldSize / 2 + x * cs + cs / 2, worldSize, mapScale, margin);
        const v = worldToUv(worldSize / 2 - y * cs - cs / 2, worldSize, mapScale, margin);
        ctx.fillText(`${getGridLetter(x)}${y}`, u * W, (1 - v) * H);
      }
    }
    ctx.restore();
  }

  /* ─── HEATMAP ─── */
  if (layers.positions && points.length > 0) {
    ctx.save();

    // Create offscreen canvas for proper heatmap blending
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const oc = off.getContext("2d");

    const r = Math.max(18, Math.round(Math.min(W, H) * 0.045));

    // 1) Draw white blobs onto offscreen (accumulate intensity)
    oc.globalCompositeOperation = "lighter";
    for (const p of points) {
      if (!p) continue;
      const u = Number(p.u), v = Number(p.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const x = toX(u), y = toY(v);
      const g = oc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.08)");
      g.addColorStop(0.5, "rgba(255,255,255,0.03)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      oc.fillStyle = g;
      oc.beginPath(); oc.arc(x, y, r, 0, Math.PI * 2); oc.fill();
    }

    // 2) Colorize — read pixels & map intensity to gradient
    const imgData = oc.getImageData(0, 0, W, H);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const intensity = d[i] / 255; // white channel = intensity
      if (intensity < 0.01) { d[i + 3] = 0; continue; }
      // cool blue → cyan → green → yellow → red
      let h2, s2, l2;
      if (intensity < 0.25) {
        h2 = lerp(220, 180, intensity / 0.25);
        s2 = 90; l2 = lerp(40, 50, intensity / 0.25);
      } else if (intensity < 0.5) {
        h2 = lerp(180, 120, (intensity - 0.25) / 0.25);
        s2 = 85; l2 = lerp(45, 50, (intensity - 0.25) / 0.25);
      } else if (intensity < 0.75) {
        h2 = lerp(120, 50, (intensity - 0.5) / 0.25);
        s2 = 90; l2 = lerp(45, 55, (intensity - 0.5) / 0.25);
      } else {
        h2 = lerp(50, 0, (intensity - 0.75) / 0.25);
        s2 = 95; l2 = lerp(50, 50, (intensity - 0.75) / 0.25);
      }
      // Convert HSL to RGB
      const hh = h2 / 360, ss = s2 / 100, ll = l2 / 100;
      let rr, gg, bb;
      if (ss === 0) { rr = gg = bb = ll; }
      else {
        const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
        const pp = 2 * ll - q;
        const hue2rgb = (p2, q2, t2) => {
          if (t2 < 0) t2 += 1; if (t2 > 1) t2 -= 1;
          if (t2 < 1/6) return p2 + (q2 - p2) * 6 * t2;
          if (t2 < 1/2) return q2;
          if (t2 < 2/3) return p2 + (q2 - p2) * (2/3 - t2) * 6;
          return p2;
        };
        rr = hue2rgb(pp, q, hh + 1/3);
        gg = hue2rgb(pp, q, hh);
        bb = hue2rgb(pp, q, hh - 1/3);
      }
      d[i]     = Math.round(rr * 255);
      d[i + 1] = Math.round(gg * 255);
      d[i + 2] = Math.round(bb * 255);
      d[i + 3] = Math.round(clamp(intensity * 2.5, 0, 0.75) * 255);
    }
    oc.putImageData(imgData, 0, 0);

    // 3) Draw coloured heatmap onto main canvas
    ctx.globalAlpha = 0.85;
    ctx.drawImage(off, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ─── ROUTE ─── */
  if (layers.kills && points.length > 1) {
    ctx.save();

    // Build raw pixel coords
    const raw = [];
    for (const p of points) {
      if (!p) continue;
      const u = Number(p.u), v = Number(p.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      raw.push({ x: toX(u), y: toY(v) });
    }
    if (raw.length < 2) { ctx.restore(); return; }

    // Downsample for performance (max ~200 control points)
    const maxCtrl = 200;
    let ctrl = raw;
    if (raw.length > maxCtrl) {
      const step = raw.length / maxCtrl;
      ctrl = [];
      for (let i = 0; i < maxCtrl; i++) ctrl.push(raw[Math.floor(i * step)]);
      ctrl.push(raw[raw.length - 1]);
    }

    // Smooth with Catmull-Rom
    const smooth = catmullRom(ctrl, 4);

    // Draw outer glow
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.15;
    for (let i = 1; i < smooth.length; i++) {
      const a = smooth[i - 1], b = smooth[i];
      const h = lerp(140, 0, b.progress);       // green → red
      ctx.strokeStyle = hsl(h, 100, 55, 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Draw main line
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    for (let i = 1; i < smooth.length; i++) {
      const a = smooth[i - 1], b = smooth[i];
      const h = lerp(140, 0, b.progress);
      ctx.strokeStyle = hsl(h, 90, 52, 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Inner bright core
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < smooth.length; i++) {
      const a = smooth[i - 1], b = smooth[i];
      const h = lerp(140, 0, b.progress);
      ctx.strokeStyle = hsl(h, 100, 78, 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Start marker
    const first = raw[0];
    ctx.beginPath(); ctx.arc(first.x, first.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e";
    ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    // Label
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("START", first.x, first.y - 10);

    // End marker
    const last = raw[raw.length - 1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("END", last.x, last.y - 10);

    ctx.restore();
  }

  /* ─── DEATHS ─── */
  if (layers.deaths && deaths.length > 0) {
    ctx.save();
    const pinH = Math.max(28, Math.min(W, H) * 0.05);

    for (let di = 0; di < deaths.length; di++) {
      const dd = deaths[di];
      const u = Number(dd.u), v = Number(dd.v);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const x = toX(u), y = toY(v);

      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(x, y + 2, pinH * 0.22, pinH * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pin with gradient
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - pinH * 0.38, y - pinH * 0.5, x - pinH * 0.48, y - pinH * 0.9, x, y - pinH);
      ctx.bezierCurveTo(x + pinH * 0.48, y - pinH * 0.9, x + pinH * 0.38, y - pinH * 0.5, x, y);
      ctx.closePath();
      const pg = ctx.createLinearGradient(x, y - pinH, x, y);
      pg.addColorStop(0, "#ef4444");
      pg.addColorStop(0.6, "#dc2626");
      pg.addColorStop(1, "#991b1b");
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner highlight
      ctx.beginPath();
      ctx.moveTo(x - pinH * 0.05, y - pinH * 0.15);
      ctx.bezierCurveTo(x - pinH * 0.25, y - pinH * 0.5, x - pinH * 0.3, y - pinH * 0.8, x - pinH * 0.05, y - pinH * 0.92);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Skull circle
      const sy = y - pinH * 0.66;
      const sr = pinH * 0.22;
      ctx.beginPath(); ctx.arc(x, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = "#fef2f2";
      ctx.fill();

      // Eyes
      const er = sr * 0.26;
      ctx.fillStyle = "#1c1917";
      ctx.beginPath(); ctx.arc(x - sr * 0.35, sy - sr * 0.05, er, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + sr * 0.35, sy - sr * 0.05, er, 0, Math.PI * 2); ctx.fill();

      // Nose
      ctx.beginPath();
      ctx.moveTo(x, sy + sr * 0.15);
      ctx.lineTo(x - sr * 0.1, sy + sr * 0.28);
      ctx.lineTo(x + sr * 0.1, sy + sr * 0.28);
      ctx.closePath();
      ctx.fillStyle = "#44403c";
      ctx.fill();

      // Mouth
      ctx.strokeStyle = "#44403c";
      ctx.lineWidth = 0.8;
      const mouthY = sy + sr * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - sr * 0.3, mouthY);
      ctx.lineTo(x + sr * 0.3, mouthY);
      ctx.stroke();
      for (let t = -2; t <= 2; t++) {
        const tx = x + t * sr * 0.15;
        ctx.beginPath();
        ctx.moveTo(tx, mouthY - sr * 0.08);
        ctx.lineTo(tx, mouthY + sr * 0.08);
        ctx.stroke();
      }

      // Number badge
      ctx.beginPath();
      ctx.arc(x + pinH * 0.3, y - pinH * 0.9, pinH * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = "#18181b";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(7, pinH * 0.18)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(di + 1), x + pinH * 0.3, y - pinH * 0.89);
    }
    ctx.restore();
  }
}

/* ─── pan clamping ─── */
function clampPan(px, py, zoom, cw, ch) {
  if (zoom <= 1) return { x: 0, y: 0 };
  return {
    x: clamp(px, -(cw * (zoom - 1)), 0),
    y: clamp(py, -(ch * (zoom - 1)), 0),
  };
}

/* ═══════ COMPONENT ═══════ */
export default function MatchActivityMap({ activity, apiBase }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [, forceRender] = useState(0);
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

  // Use refs for zoom/pan to avoid stale closures in event listeners
  const setZoom = useCallback((z) => { zoomRef.current = z; forceRender((n) => n + 1); }, []);
  const setPan  = useCallback((p) => { panRef.current = p;  forceRender((n) => n + 1); }, []);
  const zoom = zoomRef.current;
  const pan  = panRef.current;

  /* ─── sync canvas ─── */
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

  useEffect(() => { syncCanvas(); }, [syncCanvas, imgLoaded]);
  useEffect(() => {
    const fn = () => syncCanvas();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [syncCanvas]);

  /* ─── WHEEL (non-passive!) ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const z = zoomRef.current, p = panRef.current;
      const mapX = (cx - p.x) / z;
      const mapY = (cy - p.y) / z;
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      const nz = clamp(z * factor, 1, 14);
      const np = clampPan(cx - mapX * nz, cy - mapY * nz, nz, container.clientWidth, container.clientHeight);
      zoomRef.current = nz;
      panRef.current = np;
      forceRender((n) => n + 1);
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
      const container = containerRef.current;
      if (!container) return;
      const np = clampPan(d.px + (e.clientX - d.sx), d.py + (e.clientY - d.sy), zoomRef.current, container.clientWidth, container.clientHeight);
      panRef.current = np;
      forceRender((n) => n + 1);
    };
    const onUp = () => { dragRef.current = null; };
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
      if (e.touches.length === 1 && tpStart) {
        const np = clampPan(tpStart.px + (e.touches[0].clientX - tpStart.sx), tpStart.py + (e.touches[0].clientY - tpStart.sy), zoomRef.current, container.clientWidth, container.clientHeight);
        panRef.current = np; forceRender((n) => n + 1);
      } else if (e.touches.length === 2 && lastCenter) {
        const nd = gd(e.touches[0], e.touches[1]);
        const nz = clamp(zoomRef.current * (nd / lastDist), 1, 14);
        lastDist = nd;
        const rect = container.getBoundingClientRect();
        const c = gc(e.touches[0], e.touches[1]);
        const cx = c.x - rect.left, cy = c.y - rect.top;
        const mx = (cx - panRef.current.x) / zoomRef.current;
        const my = (cy - panRef.current.y) / zoomRef.current;
        const np = clampPan(cx - mx * nz, cy - my * nz, nz, container.clientWidth, container.clientHeight);
        zoomRef.current = nz; panRef.current = np; forceRender((n) => n + 1);
        lastCenter = c;
      }
    };
    const onTE = () => { tpStart = null; lastCenter = null; };
    container.addEventListener("touchstart", onTS, { passive: false });
    container.addEventListener("touchmove", onTM, { passive: false });
    container.addEventListener("touchend", onTE);
    return () => { container.removeEventListener("touchstart", onTS); container.removeEventListener("touchmove", onTM); container.removeEventListener("touchend", onTE); };
  }, []);

  /* ─── zoom buttons ─── */
  const zoomTo = useCallback((factor) => {
    const c = containerRef.current; if (!c) return;
    const cw = c.clientWidth, ch = c.clientHeight;
    const cx = cw / 2, cy = ch / 2;
    const z = zoomRef.current, p = panRef.current;
    const mx = (cx - p.x) / z, my = (cy - p.y) / z;
    const nz = clamp(z * factor, 1, 14);
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
    { key: "grid",      label: "Grid",    accent: "#3b82f6" },
    { key: "positions", label: "Heatmap", accent: "#22c55e" },
    { key: "kills",     label: "Route",   accent: "#f59e0b" },
    { key: "deaths",    label: "Deaths",  accent: "#ef4444" },
    { key: "entities",  label: "Entities",accent: "#8b5cf6" },
  ];

  return (
    <div className={fullscreen
      ? "fixed inset-0 z-50 bg-[#09090b]/95 backdrop-blur-sm p-4 flex flex-col animate-in fade-in duration-200"
      : "dark:bg-[#18181b] bg-white rounded-2xl border dark:border-zinc-800 border-zinc-200 p-4"}
    >
      {/* toggles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        {layerDefs.map(({ key, label, accent }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none group">
            <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)}
              className="w-3.5 h-3.5 rounded cursor-pointer" style={{ accentColor: accent }} />
            <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase tracking-wide">
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* info */}
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="text-[11px] text-zinc-500">
          Сэмплов: <span className="font-mono text-zinc-400">{points.length}</span>
          {deaths.length > 0 && <>{" · Смертей: "}<span className="font-mono text-red-400">{deaths.length}</span></>}
          {activity.playerName && <>{" · "}<span className="font-mono text-zinc-300">{activity.playerName}</span></>}
        </div>
        <div className="text-[10px] font-mono text-zinc-600 select-none">{activity.id}</div>
      </div>

      {/* map */}
      <div ref={containerRef}
        className={`relative overflow-hidden rounded-xl border dark:border-zinc-700/50 border-zinc-300 select-none ${fullscreen ? "flex-1" : "w-full max-w-[900px] mx-auto"}`}
        style={{ background: "#0c0c0c", cursor: dragRef.current ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
      >
        <div style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: dragRef.current ? "none" : "transform 0.08s ease-out",
          position: "relative", width: "fit-content",
        }}>
          {mapUrl ? (
            <img ref={imgRef} src={mapUrl} alt="Map" draggable={false} className="block"
              style={{ maxWidth: fullscreen ? "calc(100vh - 140px)" : "900px", width: "100%" }}
              onLoad={() => { setImgLoaded(true); setTimeout(syncCanvas, 50); }} />
          ) : (
            <div ref={imgRef} className="grid place-items-center text-sm text-zinc-600"
              style={{
                width: fullscreen ? "calc(100vh - 140px)" : "900px", aspectRatio: "1",
                background: "radial-gradient(ellipse at center, #1a2a1a 0%, #0a0a0a 70%)",
              }}>
              <div className="text-center opacity-60">
                <div className="text-3xl mb-2">🗺️</div>
                <div className="text-zinc-400 text-sm">Карта не загружена</div>
                <div className="text-[10px] text-zinc-600 mt-1">Данные активности отображены поверх</div>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        </div>

        {/* fullscreen btn */}
        <button onClick={() => setFullscreen((f) => !f)}
          className="absolute top-2.5 right-2.5 z-10 bg-black/40 hover:bg-black/70 backdrop-blur text-white/80 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-sm transition-all border border-white/5 hover:border-white/15"
          title={fullscreen ? "Выйти" : "На весь экран"}>
          {fullscreen ? "✕" : "⛶"}
        </button>

        {/* zoom buttons */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button onClick={() => zoomTo(1.5)}
            className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/80 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-lg font-bold transition-all border border-white/5 hover:border-white/15">
            +
          </button>
          <button onClick={() => zoomTo(1 / 1.5)}
            className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/80 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-lg font-bold transition-all border border-white/5 hover:border-white/15">
            −
          </button>
          {zoom > 1.05 && (
            <button onClick={resetView}
              className="bg-black/40 hover:bg-black/70 backdrop-blur text-white/70 hover:text-white rounded-lg w-8 h-8 flex items-center justify-center text-[9px] font-bold transition-all border border-white/5 hover:border-white/15 mt-0.5">
              1:1
            </button>
          )}
        </div>

        {/* zoom indicator */}
        {zoom > 1.05 && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/40 backdrop-blur text-white/70 text-[11px] font-mono px-2 py-0.5 rounded-md border border-white/5">
            {zoom.toFixed(1)}×
          </div>
        )}

        {/* legend */}
        {zoom <= 1.05 && points.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/40 backdrop-blur rounded-lg px-2.5 py-1.5 border border-white/5">
            <div className="flex items-center gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Start</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />End</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
