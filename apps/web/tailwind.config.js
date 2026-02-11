/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- The most important line
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}