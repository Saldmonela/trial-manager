/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        cream: "#F5F2EB",
        stone: {
          50: "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          800: "#292524",
          900: "#1C1917", // Main dark
          950: "#0C0A09",
        },
        gold: {
          400: "#D4C5A9",
          500: "#C6A87C", // Accent
          600: "#A38860", // Hover
        },
        olive: "#4A5D23",
        wine: "#5D232F",
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
    },
  },
  plugins: [],
};
