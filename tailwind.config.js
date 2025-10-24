/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./public/**/*.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0C10",
        primary: "#4B5FEA",
        secondary: "#3AE8B8",
        warn: "#FFAA4D",
        text: "#E5E5E5",
      },
      borderRadius: {
        xl: "12px",
      },
      boxShadow: {
        "soft-primary": "0 20px 40px -24px rgba(75, 95, 234, 0.65)",
      },
    },
  },
  plugins: [],
};
