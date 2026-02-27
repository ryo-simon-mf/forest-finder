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
      },
      keyframes: {
        'loading-bar': {
          '0%': { width: '0%', marginLeft: '0%' },
          '50%': { width: '60%', marginLeft: '20%' },
          '100%': { width: '0%', marginLeft: '100%' },
        },
      },
      animation: {
        'loading-bar': 'loading-bar 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
