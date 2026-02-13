import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { matches } from "../data/mock";
import {
  ArrowLeft,
  Sword,
  Shield,
  Heart,
  Zap,
  Target,
  Clock,
  Trophy,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { useLanguage } from "../contexts/LanguageContext";
import MatchActivityMap from "./MatchActivityMap";
import { RUST_API_BASE } from "../config";

// Mock Steam Avatar
const STEAM_AVATAR =
  "https://avatars.akamai.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";

const RoleIcon = ({ role, className }) => {
  switch (role) {
    case "Tank":
      return <Shield className={className} />;
    case "Healer":
      return <Heart className={className} />;
    case "Carry":
      return <Sword className={className} />;
    case "Support":
      return <Zap className={className} />;
    case "Flex":
      return <Target className={className} />;
    default:
      return <Sword className={className} />;
  }
};

const PlayerRow = ({ player, isRed, matchId }) => {
  const navigate = useNavigate();

  // Colors for hover states & borders
  const borderColor = isRed
    ? "border-l-red-500 hover:bg-red-900/10 hover:border-l-red-500"
    : "border-l-blue-500 hover:bg-blue-900/10 hover:border-l-blue-500";

  return (
    <div
      onClick={() => navigate(`/match/${matchId}/player/${player.id}`)}
      className={`grid grid-cols-12 gap-2 items-center px-3 py-3 dark:bg-[#18181b] bg-white rounded-lg shadow-sm border dark:border-zinc-800 border-zinc-200 dark:hover:border-zinc-700 hover:border-zinc-300 transition-all duration-200 cursor-pointer mb-2 w-full border-l-4 ${borderColor}`}
    >
      {/* 1. PLAYER (3 cols) */}
      <div className="col-span-3 flex items-center gap-3 overflow-hidden">
        <div className="relative shrink-0">
          <img
            src={STEAM_AVATAR}
            alt="Avatar"
            className="w-10 h-10 rounded-md shadow-sm"
          />
          <div className="absolute -bottom-1 -right-1 p-0.5 dark:bg-[#18181b] bg-white rounded-md shadow-sm border dark:border-zinc-800 border-zinc-200">
            <RoleIcon
              role={player.role}
              className={`w-3 h-3 ${isRed ? "text-red-500" : "text-blue-500"}`}
            />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className={`font-bold text-sm truncate leading-tight ${
              isRed
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {player.name}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono truncate">
            7656119...
          </span>
        </div>
      </div>

      {/* 2. ELO */}
      <div className="col-span-1 text-center font-mono text-sm font-bold dark:text-zinc-400 text-zinc-600">
        {player.elo}
      </div>

      {/* 3. IMPACT */}
      <div className="col-span-1 text-center flex justify-center">
        <span
          className={`text-xs font-black px-2 py-1 rounded-md w-full max-w-[60px] ${
            parseFloat(player.impact) > 1.0
              ? "bg-purple-900/30 text-purple-400"
              : "text-zinc-500 dark:bg-zinc-900 bg-zinc-100"
          }`}
        >
          {player.impact}
        </span>
      </div>

      {/* 4. KILLS */}
      <div className="col-span-1 text-center font-bold dark:text-zinc-200 text-zinc-800">
        {player.kills}
      </div>

      {/* 5. DEATHS */}
      <div className="col-span-1 text-center font-bold text-red-500">
        {player.deaths}
      </div>

      {/* 6. DMG */}
      <div className="col-span-1 text-center font-mono text-sm font-bold dark:text-zinc-300 text-zinc-700">
        {formatNumber(player.damage)}
      </div>

      {/* 7. SHOTS */}
      <div className="col-span-1 text-center text-xs font-medium text-zinc-500">
        {player.shots}
      </div>

      {/* 8. HITS */}
      <div className="col-span-1 text-center text-xs font-medium text-zinc-500">
        {player.hits}
      </div>

      {/* 9. ACC */}
      <div className="col-span-1 text-center text-xs font-bold text-zinc-400">
        {player.acc}
      </div>

      {/* 10. HS */}
      <div className="col-span-1 text-center text-xs font-bold text-orange-500">
        {player.hs}
      </div>
    </div>
  );
};

const TeamTable = ({ teamName, players, color, totalDamage, matchId }) => {
  const { t } = useLanguage();
  const isRed = color === "red";

  const headerBg = isRed
    ? "bg-red-900/10 border-red-900/20"
    : "bg-blue-900/10 border-blue-900/20";

  const headerText = isRed ? "text-red-500" : "text-blue-500";

  // Calculate Average ELO
  const totalElo = players.reduce((sum, p) => sum + p.elo, 0);
  const avgElo = Math.round(totalElo / Math.max(1, players.length));

  return (
    <div className="mb-8 w-full">
      {/* Team Header Stripe */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-xl border ${headerBg} mb-4 sticky left-0 w-full`}
      >
        <div className="flex items-center gap-3">
          <h3
            className={`font-black uppercase tracking-widest text-sm ${headerText}`}
          >
            {t(isRed ? "teamRed" : "teamBlue")}
          </h3>
          <span className="text-[10px] dark:bg-[#18181b] bg-white px-2 py-0.5 rounded-full text-zinc-500 font-bold border dark:border-zinc-800 border-zinc-200 shadow-sm">
            SQD ALPHA
          </span>
          <span className="text-[10px] dark:bg-[#18181b] bg-white px-2 py-0.5 rounded-full text-zinc-500 font-bold border dark:border-zinc-800 border-zinc-200 shadow-sm">
            {t("avgElo") || "AVG ELO"}:{" "}
            <span className="text-zinc-400">{avgElo}</span>
          </span>
        </div>
        <div className="text-xs font-bold text-zinc-400 flex gap-2 items-center">
          <span className="uppercase opacity-70 tracking-wide">
            {t("totalOutput")}:
          </span>
          <span className={`text-base ${headerText}`}>
            {formatNumber(totalDamage)}
          </span>
        </div>
      </div>

      {/* Table Header (Grid 12) */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 mb-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider w-full">
        <div className="col-span-3 pl-1">{t("player")}</div>
        <div className="col-span-1 text-center">{t("elo")}</div>
        <div className="col-span-1 text-center">{t("impact")}</div>
        <div className="col-span-1 text-center">{t("kills")}</div>
        <div className="col-span-1 text-center">{t("deaths")}</div>
        <div className="col-span-1 text-center">{t("damage")}</div>
        <div className="col-span-1 text-center">{t("shots")}</div>
        <div className="col-span-1 text-center">{t("hits")}</div>
        <div className="col-span-1 text-center">{t("acc")}</div>
        <div className="col-span-1 text-center">{t("hs")}</div>
      </div>

      {/* Rows */}
      <div className="flex flex-col w-full">
        {players.map((p) => (
          <PlayerRow key={p.id} player={p} isRed={isRed} matchId={matchId} />
        ))}
      </div>
    </div>
  );
};

export default function MatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const match = matches.find((m) => m.id === id);

  const apiBase = useMemo(() => RUST_API_BASE, []);

  const [resolvedApiBase, setResolvedApiBase] = useState(apiBase);
  const [apiProbe, setApiProbe] = useState({
    base: apiBase,
    resolved: apiBase,
    tried: [],
    ok: "probing",
    error: null,
  });

  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [activityDebug, setActivityDebug] = useState({
    url: null,
    status: null,
    error: null,
    preview: null,
    at: null,
  });

  useEffect(() => {
    let cancelled = false;

    const tryHealth = async (base) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const url = `${base}/simplemap/health`;
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) return { ok: false, status: r.status };
        const j = await r.json().catch(() => null);
        const isSimpleMap = Boolean(j?.ok) && j?.plugin === "SimpleMapGUI";
        return { ok: isSimpleMap, status: r.status, json: j };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      } finally {
        window.clearTimeout(timeoutId);
        controller.abort();
      }
    };

    const probe = async () => {
      setApiProbe({ base: apiBase, resolved: apiBase, tried: [], ok: "probing", error: null });

      let u;
      try {
        u = new URL(apiBase);
      } catch {
        setApiProbe({ base: apiBase, resolved: apiBase, tried: [], ok: false, error: "Invalid RUST_API_BASE" });
        return;
      }

      const basePort = Number(u.port || (u.protocol === "https:" ? 443 : 80));
      const maxTries = 6; // 28080..28085
      const tried = [];

      for (let i = 0; i < maxTries; i++) {
        if (cancelled) return;
        const port = basePort + i;
        const candidate = `${u.protocol}//${u.hostname}${port ? `:${port}` : ""}`;
        tried.push(candidate);
        setApiProbe((p) => ({ ...p, tried: [...tried] }));

        const res = await tryHealth(candidate);
        if (res.ok) {
          if (cancelled) return;
          setResolvedApiBase(candidate);
          setApiProbe({ base: apiBase, resolved: candidate, tried: [...tried], ok: true, error: null });
          return;
        }
      }

      if (cancelled) return;
      setResolvedApiBase(apiBase);
      setApiProbe({
        base: apiBase,
        resolved: apiBase,
        tried: [...tried],
        ok: false,
        error: "Health check failed on all tried ports",
      });
    };

    probe();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setActivityError(null);

    const url = `${resolvedApiBase}/simplemap/match/${encodeURIComponent(id)}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    setActivityDebug({ url, status: null, error: null, preview: null, at: new Date().toISOString() });

    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        const text = await r.text();
        setActivityDebug((d) => ({
          ...d,
          status: r.status,
          preview: (text || "").slice(0, 600),
        }));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return text ? JSON.parse(text) : null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data && data.error) {
          setActivity(null);
          return;
        }
        setActivity(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
        setActivityDebug((d) => ({ ...d, error: msg }));
        setActivityError(msg);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [resolvedApiBase, id]);

  if (!match) {
    return (
      <div className="w-full animate-in fade-in zoom-in-95 duration-300 pb-20">
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-zinc-500 dark:hover:text-white hover:text-zinc-900 transition-colors text-xs font-bold uppercase tracking-widest mb-4 pl-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("backToMatches")}
          </button>

          <div className="dark:bg-[#18181b] bg-white border dark:border-zinc-800 border-zinc-200 shadow-sm rounded-lg overflow-hidden p-4">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Матч не найден в mock
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              ID: <span className="font-mono">{id}</span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Активность всё равно будет показана, если ты записал её в игре командой
              <span className="font-mono"> /solo {id}</span> или
              <span className="font-mono"> /solostart {id}</span>.
            </div>
          </div>
        </div>

        <div className="mb-8">
          <MatchActivityMap activity={activity} apiBase={resolvedApiBase} />
          {activityError ? (
            <div className="mt-2 text-[11px] text-zinc-500">
              Activity API недоступен: <span className="font-mono">{activityError}</span>
            </div>
          ) : !activity ? (
            <div className="mt-2 text-[11px] text-zinc-500">
              Нет активности для этого ID. Сначала запусти запись в игре.
            </div>
          ) : null}

          <div className="mt-3 dark:bg-[#18181b] bg-white rounded-xl border dark:border-zinc-800 border-zinc-200 p-3">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Debug</div>
            <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
              apiBase: {apiBase}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono break-all">
              resolvedApiBase: {resolvedApiBase}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
              probeOk: {String(apiProbe.ok)}
              {apiProbe.error ? ` | probeError: ${apiProbe.error}` : ""}
            </div>
            {apiProbe.tried?.length ? (
              <div className="text-[11px] text-zinc-500 font-mono break-all">
                tried: {apiProbe.tried.join(" | ")}
              </div>
            ) : null}
            {activityDebug?.url ? (
              <>
                <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
                  url: {activityDebug.url}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono break-all">
                  status: {activityDebug.status ?? "-"} | error: {activityDebug.error ?? "-"}
                </div>
                {activityDebug.preview ? (
                  <div className="mt-2 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words max-h-[160px] overflow-auto">
                    {activityDebug.preview}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const isRedWinner = match.winner === "red";

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300 pb-20">
      {/* Navigation & Header Combined Container */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-zinc-500 dark:hover:text-white hover:text-zinc-900 transition-colors text-xs font-bold uppercase tracking-widest mb-4 pl-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("backToMatches")}
        </button>

        {/* Ultra-Thin Header */}
        <div className="dark:bg-[#18181b] bg-white border-y dark:border-zinc-800 border-zinc-200 shadow-sm rounded-lg overflow-hidden">
          <div className="flex items-center justify-between h-16 px-4 md:px-8 w-full">
            {/* Left: Map & Time */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-lg font-black uppercase tracking-tighter dark:text-zinc-100 text-zinc-900 leading-none">
                  {match.map}
                </span>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                  <Clock size={10} />
                  {match.duration}
                </div>
              </div>
            </div>

            {/* Center: Score */}
            <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
              <span
                className={`text-4xl font-black tabular-nums tracking-tighter ${
                  isRedWinner
                    ? "text-red-500"
                    : "dark:text-zinc-600 text-zinc-300"
                }`}
              >
                {match.score.red}
              </span>
              <span className="text-sm font-bold text-zinc-700 uppercase tracking-widest">
                VS
              </span>
              <span
                className={`text-4xl font-black tabular-nums tracking-tighter ${
                  !isRedWinner
                    ? "text-blue-500"
                    : "dark:text-zinc-600 text-zinc-300"
                }`}
              >
                {match.score.blue}
              </span>
            </div>

            {/* Right: Winner */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  isRedWinner
                    ? "bg-red-900/20 text-red-500"
                    : "bg-blue-900/20 text-blue-500"
                }`}
              >
                <Trophy size={12} />
                {t("winner")}: {isRedWinner ? t("teamRed") : t("teamBlue")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <MatchActivityMap activity={activity} apiBase={resolvedApiBase} />
        {activityError ? (
          <div className="mt-2 text-[11px] text-zinc-500">
            Activity API недоступен: <span className="font-mono">{activityError}</span>
          </div>
        ) : null}

        <div className="mt-3 dark:bg-[#18181b] bg-white rounded-xl border dark:border-zinc-800 border-zinc-200 p-3">
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Debug</div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
            apiBase: {apiBase}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono break-all">
            resolvedApiBase: {resolvedApiBase}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
            probeOk: {String(apiProbe.ok)}
            {apiProbe.error ? ` | probeError: ${apiProbe.error}` : ""}
          </div>
          {apiProbe.tried?.length ? (
            <div className="text-[11px] text-zinc-500 font-mono break-all">
              tried: {apiProbe.tried.join(" | ")}
            </div>
          ) : null}
          {activityDebug?.url ? (
            <>
              <div className="mt-2 text-[11px] text-zinc-500 font-mono break-all">
                url: {activityDebug.url}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono break-all">
                status: {activityDebug.status ?? "-"} | error: {activityDebug.error ?? "-"}
              </div>
              {activityDebug.preview ? (
                <div className="mt-2 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words max-h-[160px] overflow-auto">
                  {activityDebug.preview}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Content Grid - Full Width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 md:px-0 w-full">
        <TeamTable
          teamName="Red"
          color="red"
          players={match.teams.red}
          totalDamage={match.totalDamage.red}
          matchId={id}
        />

        <TeamTable
          teamName="Blue"
          color="blue"
          players={match.teams.blue}
          totalDamage={match.totalDamage.blue}
          matchId={id}
        />
      </div>
    </div>
  );
}
