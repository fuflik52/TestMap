/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "team-red": "#ef4444",
        "team-blue": "#3b82f6",
        "dark-bg": "#09090b",
        "dark-card": "#18181b",
        "dark-hover": "#27272a",
      },
    },
  },
  plugins: [],
};
