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
    container: {
      center: false,          // don't center, let it be full width
      padding: {
        DEFAULT: "0",         // no automatic side padding
      },
      screens: {
        sm: "100%",
        md: "100%",
        lg: "100%",
        xl: "100%",
        "2xl": "100%",
      },
    },
  },
  plugins: [],
};
