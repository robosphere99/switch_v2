/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3b82f6', // blue-500
        },
        night: {
          900: '#111827',
          800: '#1f2937',
        }
      }
    },
  },
  plugins: [],
}
