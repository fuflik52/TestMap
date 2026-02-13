import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MatchList from "./components/MatchList";
import MatchDetails from "./components/MatchDetails";
import PlayerDetails from "./components/PlayerDetails";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

const AppContent = () => {
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen dark:bg-[#09090b] bg-zinc-50 dark:text-zinc-100 text-zinc-900 font-sans selection:bg-blue-900 selection:text-white transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        <header className="mb-6 flex items-center justify-end gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <button
            onClick={toggleTheme}
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="flex items-center gap-2 text-xs font-black tracking-widest font-mono select-none">
            <button
              onClick={() => setLanguage("ru")}
              className={`${language === "ru" ? "text-white" : "text-zinc-600 hover:text-zinc-400"} transition-colors`}
            >
              RU
            </button>
            <span className="text-zinc-800">/</span>
            <button
              onClick={() => setLanguage("en")}
              className={`${language === "en" ? "text-white" : "text-zinc-600 hover:text-zinc-400"} transition-colors`}
            >
              US
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<MatchList />} />
          <Route path="/match/:id" element={<MatchDetails />} />
          <Route
            path="/match/:matchId/player/:playerId"
            element={<PlayerDetails />}
          />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
