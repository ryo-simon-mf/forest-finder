import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        forest: {
          DEFAULT: "rgba(27, 172, 83, 1)",
          dark: "rgba(20, 140, 67, 1)",
        },
        konbini: {
          DEFAULT: "rgba(59, 130, 246, 1)",
          dark: "rgba(37, 99, 235, 1)",
        },
        station: {
          DEFAULT: "rgba(239, 68, 68, 1)",
          dark: "rgba(220, 38, 38, 1)",
        },
      },
      keyframes: {
        'loading-progress': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        'blink': {
          '0%, 20%': { opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'loading-progress': 'loading-progress 5s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
