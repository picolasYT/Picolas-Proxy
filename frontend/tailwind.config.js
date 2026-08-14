/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#07070c",
          900: "#0c0c14",
          850: "#111119",
          800: "#16161f",
          700: "#20202c",
          600: "#2c2c3a",
        },
        violet: { 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed" },
        magenta: { 400: "#f472e0", 500: "#e84fd0" },
        cyan: { 400: "#22d3ee", 500: "#06b6d4" },
      },
      backgroundImage: {
        "picolas-gradient": "linear-gradient(135deg, #7c3aed 0%, #e84fd0 55%, #22d3ee 100%)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(139, 92, 246, 0.35)",
      },
    },
  },
  plugins: [],
};
