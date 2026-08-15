/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#0f172a",
          900: "#f1f5f9",
          800: "#ffffff",
          700: "#e8eef6",
          600: "#cbd5e1",
          500: "#94a3b8",
        },
        brand: {
          DEFAULT: "#2563eb",
          light: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
