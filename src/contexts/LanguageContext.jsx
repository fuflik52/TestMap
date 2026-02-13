import React, { createContext, useContext, useState } from "react";

const translations = {
  ru: {
    title: "Rust Battle Tracker",
    subtitle: "История матчей и статистика",
    recentMatches: "Последние матчи",
    gamesPlayed: "игр сыграно",
    last30Days: "За 30 дней",
    teamRed: "Красные",
    teamBlue: "Синие",
    winner: "Победитель",
    victory: "Победа",
    vs: "против",
    totalOutput: "Общий урон",
    totalDamage: "Урон",
    player: "Игрок",
    kda: "У / С / П",
    ratio: "КД",
    damage: "Урон",
    backToMatches: "К списку матчей",
    backToMatch: "Назад к матчу",
    combatPerformance: "Боевая статистика",
    impactDistribution: "Вклад в игру",
    kills: "Убийства",
    deaths: "Смерти",
    assists: "Помощь",
    statistics: "Показатели",
    eliminations: "Устранения",
    avgDmgRound: "Ср. урон/раунд",
    damageAnalysis: "График урона",
    performanceTimeline: "Динамика по раундам",
    peakDamage: "Пик урона",
    roundBreakdown: "Детали раундов",
    returnHome: "На главную",
    matchNotFound: "Матч не найден",
    searching: "Загрузка данных...",
    playerNotFound: "Игрок не найден",
    round: "Раунд",
    steamId: "Steam ID",
    dmgShare: "Доля урона",
    kdRatio: "Соотношение K/D",
    elo: "ELO",
    impact: "Impact",
    shots: "Выстрелы",
    hits: "Попадания",
    acc: "Точность",
    hs: "HS%",
  },
  en: {
    title: "Rust Battle Tracker",
    subtitle: "Match History & Statistics",
    recentMatches: "Recent Matches",
    gamesPlayed: "games played",
    last30Days: "Last 30 Days",
    teamRed: "Team Red",
    teamBlue: "Team Blue",
    winner: "Winner",
    victory: "Victory",
    vs: "vs",
    totalOutput: "Total Output",
    totalDamage: "Total Damage",
    player: "Player",
    kda: "K / D / A",
    ratio: "Ratio",
    damage: "Damage",
    backToMatches: "Back to Matches",
    backToMatch: "Back to Match",
    combatPerformance: "Combat Performance",
    impactDistribution: "Impact Distribution",
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    statistics: "Statistics",
    eliminations: "Eliminations",
    avgDmgRound: "Avg Dmg/Round",
    damageAnalysis: "Damage Analysis",
    performanceTimeline: "Performance timeline",
    peakDamage: "Peak Damage",
    roundBreakdown: "Round Breakdown",
    returnHome: "Return to Dashboard",
    matchNotFound: "Match not found",
    searching: "Searching records...",
    playerNotFound: "Player not found",
    round: "Round",
    steamId: "Steam ID",
    dmgShare: "Dmg Share",
    kdRatio: "K/D Ratio",
    elo: "ELO",
    impact: "Impact",
    shots: "Shots",
    hits: "Hits",
    acc: "Accuracy",
    hs: "HS%",
  },
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("ru");

  const t = (key) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
