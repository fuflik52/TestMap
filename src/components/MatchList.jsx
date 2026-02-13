import { matches } from "../data/mock";
import { ChevronRight, Calendar, Clock, Trophy, Swords } from "lucide-react";
import { cn, formatNumber } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function MatchList() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold dark:text-zinc-100 text-zinc-900 tracking-tight flex items-center gap-3">
          <div className="p-2 dark:bg-blue-900/20 bg-blue-100 rounded-2xl dark:text-blue-400 text-blue-600">
            <Swords size={20} />
          </div>
          {t("recentMatches")}
        </h2>
        <div className="flex items-center gap-2 text-xs font-semibold dark:text-zinc-400 text-zinc-600 dark:bg-[#18181b] bg-white px-4 py-2 rounded-full shadow-sm border dark:border-zinc-800 border-zinc-200">
          <Calendar size={14} className="text-zinc-500" />
          <span>{t("last30Days")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {matches.map((match, index) => {
          const isRedWinner = match.winner === "red";
          const isBlueWinner = match.winner === "blue";

          return (
            <div
              key={match.id}
              onClick={() => navigate(`/match/${match.id}`)}
              style={{ animationDelay: `${index * 50}ms` }}
              className="group relative dark:bg-[#18181b] bg-white rounded-3xl p-1 border dark:border-zinc-800 border-zinc-200 dark:hover:border-zinc-700 hover:border-zinc-300 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards"
            >
              {/* Side Glow Effects */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-red-600/20 blur-[50px] rounded-full -translate-x-16 opacity-50 group-hover:opacity-80 transition-opacity duration-500 pointer-events-none z-0" />
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-blue-600/20 blur-[50px] rounded-full translate-x-16 opacity-50 group-hover:opacity-80 transition-opacity duration-500 pointer-events-none z-0" />

              <div className="relative dark:bg-[#18181b]/80 bg-white/80 backdrop-blur-sm rounded-[20px] px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-6 z-10 dark:hover:bg-[#202023]/80 hover:bg-zinc-50/80 transition-colors">
                {/* Red Team */}
                <div className="flex flex-col items-center md:items-start w-full md:w-1/3 gap-1">
                  <span className="text-sm font-bold uppercase tracking-wider transition-colors text-red-500">
                    {t("teamRed")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold dark:text-zinc-100 text-zinc-900 tabular-nums">
                      {formatNumber(match.totalDamage.red)}
                    </span>
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:bg-zinc-900 bg-zinc-100 px-2 py-1 rounded-lg">
                      {t("damage")}
                    </span>
                  </div>
                  {isRedWinner && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-red-400 bg-red-900/20 px-3 py-1 rounded-full">
                      <Trophy size={12} /> {t("victory")}
                    </div>
                  )}
                </div>

                {/* Score & Info */}
                <div className="flex flex-col items-center justify-center w-full md:w-1/3">
                  <div className="flex items-center justify-center gap-6">
                    <span
                      className={cn(
                        "text-5xl font-black tracking-tighter tabular-nums transition-all text-red-500",
                        isRedWinner &&
                          "scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]",
                      )}
                    >
                      {match.score.red}
                    </span>
                    <span className="dark:text-zinc-700 text-zinc-300 text-3xl font-light">
                      /
                    </span>
                    <span
                      className={cn(
                        "text-5xl font-black tracking-tighter tabular-nums transition-all text-blue-500",
                        isBlueWinner &&
                          "scale-110 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]",
                      )}
                    >
                      {match.score.blue}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs font-bold dark:text-zinc-400 text-zinc-600 dark:bg-zinc-900 bg-zinc-100 px-4 py-1.5 rounded-full border dark:border-zinc-800 border-zinc-200">
                    <span>{match.map}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-600" />
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {match.duration}
                    </span>
                  </div>
                </div>

                {/* Blue Team */}
                <div className="flex flex-col items-center md:items-end w-full md:w-1/3 gap-1 text-right">
                  <span className="text-sm font-bold uppercase tracking-wider transition-colors text-blue-500">
                    {t("teamBlue")}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:bg-zinc-900 bg-zinc-100 px-2 py-1 rounded-lg">
                      {t("damage")}
                    </span>
                    <span className="text-2xl font-bold dark:text-zinc-100 text-zinc-900 tabular-nums">
                      {formatNumber(match.totalDamage.blue)}
                    </span>
                  </div>
                  {isBlueWinner && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full">
                      {t("victory")} <Trophy size={12} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
