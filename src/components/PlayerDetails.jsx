import { useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { matches } from "../data/mock";
import {
  ArrowLeft,
  Sword,
  Shield,
  Heart,
  Zap,
  Target,
  Crosshair,
  Skull,
  Activity,
  Award,
  Hash,
  Percent,
  Copy,
  Check,
  TrendingUp,
  X,
  User,
  ScanEye,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { DamageSparkline, PerformanceRadar } from "./Charts";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";

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

const HitAnalysisModal = ({ isOpen, onClose, hits, t }) => {
  if (!isOpen) return null;

  const totalHits = Object.values(hits).reduce((a, b) => a + b, 0);
  const getPercent = (val) => ((val / totalHits) * 100).toFixed(1);

  const parts = [
    { name: "head", value: hits.head, color: "bg-red-500" },
    { name: "neck", value: hits.neck, color: "bg-orange-500" },
    { name: "chest", value: hits.chest, color: "bg-yellow-500" },
    { name: "stomach", value: hits.stomach, color: "bg-green-500" },
    { name: "leftArm", value: hits.leftArm, color: "bg-blue-500" },
    { name: "rightArm", value: hits.rightArm, color: "bg-blue-500" },
    { name: "leftLeg", value: hits.leftLeg, color: "bg-purple-500" },
    { name: "rightLeg", value: hits.rightLeg, color: "bg-purple-500" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md dark:bg-[#18181b] bg-white rounded-xl shadow-2xl border dark:border-zinc-800 border-zinc-200 p-6 m-4 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-black dark:text-white text-zinc-900 mb-1 flex items-center gap-2">
          <Crosshair size={24} className="text-red-500" />
          {t("hitAnalysis")}
        </h3>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">
          {t("hitDistribution")}
        </p>

        <div className="flex flex-col gap-3">
          {parts.map((part) => (
            <div key={part.name} className="group">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-bold dark:text-zinc-300 text-zinc-700 capitalize">
                  {t(part.name) || part.name}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-mono font-bold dark:text-white text-zinc-900">
                    {part.value}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    ({getPercent(part.value)}%)
                  </span>
                </div>
              </div>
              <div className="h-2 w-full dark:bg-zinc-800 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${part.color} transition-all duration-500 ease-out`}
                  style={{ width: `${getPercent(part.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function PlayerDetails() {
  const { matchId, playerId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [statsPage, setStatsPage] = useState(0);
  const dragStartX = useRef(null);
  const [showHitModal, setShowHitModal] = useState(false);

  const data = useMemo(() => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return null;

    const allPlayers = [...match.teams.red, ...match.teams.blue];
    const player = allPlayers.find((p) => p.id === playerId);
    const isRed = match.teams.red.some((p) => p.id === playerId);
    const teamTotalDamage = (isRed ? match.teams.red : match.teams.blue).reduce(
      (sum, p) => sum + p.damage,
      0,
    );

    return { match, player, isRed, teamTotalDamage };
  }, [matchId, playerId]);

  if (!data)
    return <div className="text-white text-center mt-20">Player not found</div>;

  const { player, isRed, teamTotalDamage } = data;
  const damageShare = Math.round((player.damage / teamTotalDamage) * 100);
  const kdRatio = (player.kills / Math.max(1, player.deaths)).toFixed(2);
  const themeText = isRed ? "text-red-500" : "text-blue-500";
  const sparklineColor = isRed ? "#ef4444" : "#3b82f6";

  const steamId = "76561198012345678"; // Mock SteamID

  const handleCopySteamId = () => {
    navigator.clipboard.writeText(steamId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mock Hit Stats based on total hits
  const hitStats = useMemo(() => {
    const total = player.hits || 100;
    // Rough distribution
    return {
      head: Math.round(total * 0.2),
      neck: Math.round(total * 0.05),
      chest: Math.round(total * 0.35),
      stomach: Math.round(total * 0.15),
      leftArm: Math.round(total * 0.08),
      rightArm: Math.round(total * 0.08),
      leftLeg: Math.round(total * 0.05),
      rightLeg: Math.round(total * 0.04),
    };
  }, [player.hits]);

  const allStats = [
    {
      label: "kills",
      value: player.kills,
      icon: Skull,
      color: "text-green-500",
      bg: "bg-green-500/5 dark:bg-green-500/10",
      border: "border-green-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]",
      hoverBorder: "group-hover:border-green-500/40",
      hoverBg: "group-hover:bg-green-500/10",
      action: () => setShowHitModal(true),
      cursor: "cursor-pointer",
    },
    {
      label: "deaths",
      value: player.deaths,
      icon: Crosshair,
      color: "text-red-500",
      bg: "bg-red-500/5 dark:bg-red-500/10",
      border: "border-red-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      hoverBorder: "group-hover:border-red-500/40",
      hoverBg: "group-hover:bg-red-500/10",
    },
    {
      label: "assists",
      value: player.assists,
      icon: Zap,
      color: "text-yellow-500",
      bg: "bg-yellow-500/5 dark:bg-yellow-500/10",
      border: "border-yellow-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]",
      hoverBorder: "group-hover:border-yellow-500/40",
      hoverBg: "group-hover:bg-yellow-500/10",
    },
    {
      label: "impact",
      value: player.impact,
      icon: Award,
      color: "text-purple-500",
      bg: "bg-purple-500/5 dark:bg-purple-500/10",
      border: "border-purple-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]",
      hoverBorder: "group-hover:border-purple-500/40",
      hoverBg: "group-hover:bg-purple-500/10",
    },
    {
      label: "shots",
      value: player.shots,
      icon: Target,
      color: "text-zinc-400",
      bg: "bg-zinc-500/5 dark:bg-zinc-500/10",
      border: "border-zinc-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(161,161,170,0.2)]",
      hoverBorder: "group-hover:border-zinc-500/40",
      hoverBg: "group-hover:bg-zinc-500/10",
    },
    {
      label: "hits",
      value: player.hits,
      icon: Crosshair,
      color: "text-blue-400",
      bg: "bg-blue-500/5 dark:bg-blue-500/10",
      border: "border-blue-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]",
      hoverBorder: "group-hover:border-blue-500/40",
      hoverBg: "group-hover:bg-blue-500/10",
      action: () => setShowHitModal(true),
      cursor: "cursor-pointer",
    },
    {
      label: "acc",
      value: player.acc,
      icon: Percent,
      color: "text-cyan-400",
      bg: "bg-cyan-500/5 dark:bg-cyan-500/10",
      border: "border-cyan-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]",
      hoverBorder: "group-hover:border-cyan-500/40",
      hoverBg: "group-hover:bg-cyan-500/10",
    },
    {
      label: "hs",
      value: player.hs,
      icon: Skull,
      color: "text-orange-500",
      bg: "bg-orange-500/5 dark:bg-orange-500/10",
      border: "border-orange-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]",
      hoverBorder: "group-hover:border-orange-500/40",
      hoverBg: "group-hover:bg-orange-500/10",
    },
    {
      label: "avgDmgRound",
      value: formatNumber(Math.round(player.damage / player.history.length)),
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/5 dark:bg-emerald-500/10",
      border: "border-emerald-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]",
      hoverBorder: "group-hover:border-emerald-500/40",
      hoverBg: "group-hover:bg-emerald-500/10",
    },
    {
      label: "dmgShare",
      value: `${damageShare}%`,
      icon: Hash,
      color: "text-indigo-400",
      bg: "bg-indigo-500/5 dark:bg-indigo-500/10",
      border: "border-indigo-500/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(129,140,248,0.2)]",
      hoverBorder: "group-hover:border-indigo-500/40",
      hoverBg: "group-hover:bg-indigo-500/10",
    },
  ];

  // Translated Radar Labels
  const radarData = [
    { label: t("kills"), value: player.kills, max: 50 },
    { label: t("impact"), value: parseFloat(player.impact), max: 4 },
    { label: t("assists"), value: player.assists, max: 30 },
    { label: t("hs"), value: parseInt(player.hs), max: 80 },
    { label: t("acc"), value: parseFloat(player.acc), max: 60 },
    { label: t("damage"), value: player.damage, max: 60000 },
  ];

  return (
    <div className="min-h-screen dark:bg-[#09090b] bg-zinc-50 dark:text-zinc-100 text-zinc-900 pb-20 animate-in fade-in duration-300 w-full font-sans">
      <div className="max-w-7xl mx-auto p-4 md:p-4 pt-4">
        {/* Navigation & Compact Header */}
        <div className="flex flex-col gap-4 mb-4">
          <button
            onClick={() => navigate(`/match/${matchId}`)}
            className="self-start flex items-center gap-2 text-zinc-500 dark:hover:text-white hover:text-zinc-900 transition-colors text-xs font-bold uppercase tracking-widest dark:bg-[#18181b] bg-white border dark:border-zinc-800 border-zinc-200 px-3 py-1.5 rounded-md dark:hover:border-zinc-600 hover:border-zinc-300"
          >
            <ArrowLeft size={14} />
            {t("backToMatch")}
          </button>

          {/* New Compact Minimalist Header */}
          <div className="dark:bg-[#18181b] bg-white border dark:border-zinc-800 border-zinc-200 rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Player Info */}
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="relative">
                <img
                  src={STEAM_AVATAR}
                  alt={player.name}
                  className={`w-16 h-16 rounded-lg border-2 ${isRed ? "border-red-500/50" : "border-blue-500/50"} shadow-lg`}
                />
                <div
                  className={`absolute -bottom-2 -right-2 p-1 rounded-md dark:bg-[#09090b] bg-zinc-100 border dark:border-zinc-700 border-zinc-300 ${isRed ? "text-red-500" : "text-blue-500"}`}
                >
                  <RoleIcon role={player.role} className="w-3 h-3" />
                </div>
              </div>

              <div className="flex flex-col">
                <h1 className="text-2xl font-black dark:text-white text-zinc-900 tracking-tight leading-none mb-1">
                  {player.name}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isRed ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}
                  >
                    {player.role}
                  </span>

                  {/* Steam ID */}
                  <div
                    className="flex items-center gap-1.5 dark:bg-zinc-900/50 bg-zinc-100/50 px-2 py-0.5 rounded border dark:border-zinc-800 border-zinc-200 dark:hover:border-zinc-600 hover:border-zinc-300 transition-colors cursor-pointer group"
                    onClick={handleCopySteamId}
                  >
                    <span className="text-[10px] font-mono text-zinc-500 dark:group-hover:text-zinc-300 group-hover:text-zinc-700 transition-colors">
                      {steamId}
                    </span>
                    {copied ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy
                        size={10}
                        className="text-zinc-600 group-hover:text-zinc-400"
                      />
                    )}
                  </div>

                  <span className="text-[10px] font-bold text-zinc-500 ml-1">
                    ELO:{" "}
                    <span className="dark:text-zinc-300 text-zinc-700">
                      {player.elo}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Key Metrics (Big Numbers) */}
            <div className="flex items-center gap-8 md:gap-12 dark:bg-zinc-900/30 bg-zinc-100/50 px-6 py-3 rounded-lg border dark:border-zinc-800/50 border-zinc-200">
              <div className="flex flex-col items-center">
                <span
                  className={`text-3xl font-black leading-none ${themeText} drop-shadow-sm`}
                >
                  {kdRatio}
                </span>
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mt-1">
                  {t("kdRatio")}
                </span>
              </div>

              <div className="w-px h-8 dark:bg-zinc-800 bg-zinc-300" />

              <div className="flex flex-col items-center">
                <span className="text-3xl font-black leading-none dark:text-white text-zinc-900 drop-shadow-sm">
                  {formatNumber(player.damage)}
                </span>
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mt-1">
                  {t("totalDamage")}
                </span>
              </div>

              <div className="w-px h-8 dark:bg-zinc-800 bg-zinc-300" />

              <div className="flex flex-col items-center">
                <span className="text-3xl font-black leading-none dark:text-white text-zinc-900 drop-shadow-sm">
                  {player.impact}
                </span>
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mt-1">
                  {t("impact")}
                </span>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: Radar & Stats Grid */}
            <div className="flex flex-col gap-6 h-full">
              <div className="dark:bg-[#18181b] bg-white rounded-xl p-6 shadow-lg border dark:border-zinc-800 border-zinc-200 relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-30" />

                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 text-center">
                  {t("combatPerformance")}
                </h3>

                {/* Radar Chart */}
                <div className="flex justify-center mb-8 h-[220px] items-center">
                  <PerformanceRadar
                    data={radarData}
                    color={isRed ? "#ef4444" : "#3b82f6"}
                    size={220}
                  />
                </div>

                {/* UNIFIED STATS GRID */}
                <div
                  className="grid grid-cols-2 gap-3 mt-auto group/grid relative pb-3 cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={(e) => {
                    dragStartX.current = e.clientX;
                  }}
                  onMouseUp={(e) => {
                    if (dragStartX.current === null) return;
                    const diff = dragStartX.current - e.clientX;
                    if (diff > 50) setStatsPage(1);
                    if (diff < -50) setStatsPage(0);
                    dragStartX.current = null;
                  }}
                  onMouseLeave={() => {
                    dragStartX.current = null;
                  }}
                >
                  {allStats
                    .slice(statsPage * 6, (statsPage + 1) * 6)
                    .map((stat, idx) => (
                      <div
                        key={idx}
                        onClick={stat.action}
                        className={`group relative p-3 rounded-lg border transition-all duration-300
                        ${stat.bg} ${stat.border} ${stat.cursor || "cursor-default"}
                        opacity-100 group-hover/grid:opacity-30 hover:!opacity-100 hover:!scale-[1.02] ${stat.hoverBg} ${stat.hoverBorder} hover:z-10
                      `}
                      >
                        {stat.action && (
                          <div className="absolute top-2 right-2 text-zinc-400/50 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors animate-pulse">
                            <ScanEye size={16} />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-1 pl-1">
                          <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider dark:group-hover:text-zinc-300 group-hover:text-zinc-700 transition-colors">
                            {t(stat.label)}
                          </span>
                          <stat.icon
                            size={14}
                            className={`${stat.color} opacity-70 group-hover:opacity-100 group-hover:drop-shadow-sm`}
                          />
                        </div>
                        <div
                          className={`text-xl font-bold dark:text-white text-zinc-900 pl-1 ${stat.glow} transition-all`}
                        >
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  {statsPage === 1 && (
                    <>
                      <div className="p-3 rounded-lg border dark:border-zinc-800/30 border-zinc-200 dark:bg-zinc-900/10 bg-zinc-100 opacity-30"></div>
                      <div className="p-3 rounded-lg border dark:border-zinc-800/30 border-zinc-200 dark:bg-zinc-900/10 bg-zinc-100 opacity-30"></div>
                    </>
                  )}

                  {/* Pagination Dots */}
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-2 pointer-events-auto">
                    {[0, 1].map((page) => (
                      <button
                        key={page}
                        onClick={() => setStatsPage(page)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          statsPage === page
                            ? "bg-zinc-400 w-6"
                            : "dark:bg-zinc-800 bg-zinc-300 w-1.5 hover:bg-zinc-600"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Timeline & Rounds */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Damage Graph Card */}
              <div className="dark:bg-[#18181b] bg-white rounded-xl p-6 shadow-lg border dark:border-zinc-800 border-zinc-200 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-800 border-zinc-200`}
                    >
                      <TrendingUp size={18} className="text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold dark:text-white text-zinc-900 uppercase tracking-wide">
                        {t("damageAnalysis")}
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        {t("performanceTimeline")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black dark:text-white text-zinc-900 tabular-nums">
                      {formatNumber(
                        Math.max(...player.history.map((h) => h.damage)),
                      )}
                    </span>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      {t("peakDamage")}
                    </p>
                  </div>
                </div>

                <div className="flex-1 w-full flex items-center justify-center min-h-[250px] dark:bg-zinc-900/30 bg-zinc-50 rounded-lg border dark:border-zinc-800/50 border-zinc-200 p-4 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
                  <DamageSparkline
                    data={player.history}
                    color={sparklineColor}
                    width={800}
                    height={250}
                  />
                </div>
              </div>

              {/* Rounds Grid */}
              <div className="dark:bg-[#18181b] bg-white rounded-xl p-6 shadow-lg border dark:border-zinc-800 border-zinc-200">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Hash size={14} /> {t("roundBreakdown")}
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {player.history.map((round) => (
                    <div
                      key={round.round}
                      className="flex flex-col items-center justify-center p-3 rounded-lg dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-800 border-zinc-200 dark:hover:border-zinc-600 hover:border-zinc-300 dark:hover:bg-[#202023] hover:bg-zinc-200 transition-all cursor-default"
                    >
                      <span className="text-[9px] font-bold text-zinc-500 uppercase mb-1">
                        {t("round")} {round.round}
                      </span>
                      <span className={`text-sm font-black ${themeText}`}>
                        {formatNumber(round.damage)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HitAnalysisModal
        isOpen={showHitModal}
        onClose={() => setShowHitModal(false)}
        hits={hitStats}
        t={t}
      />
    </div>
  );
}
