/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        srgDark: "#121212",
        srgPurple: "#3b0a55",
        srgGray: "#1e1e2f",
      },
    },
  },
  plugins: [],
};
