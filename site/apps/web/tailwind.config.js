/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "rgb(var(--night-950) / <alpha-value>)",
          900: "rgb(var(--night-900) / <alpha-value>)",
          800: "rgb(var(--night-800) / <alpha-value>)",
          700: "rgb(var(--night-700) / <alpha-value>)",
          600: "rgb(var(--night-600) / <alpha-value>)",
          500: "rgb(var(--night-500) / <alpha-value>)",
        },
        brand: {
          // Runtime-configurable — Admin → Settings se brand color change hota hai
          // (stores/site.ts applyBrandColor --brand/--brand-light CSS var set karta hai).
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          light: "rgb(var(--brand-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
