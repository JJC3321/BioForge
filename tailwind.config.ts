import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm "paper" palette — cream backgrounds, soft warm grays, deep ink.
        // Mirrors anthropic.com's surface tones.
        ink: {
          50: "#FAF9F5",
          100: "#F5F4ED",
          200: "#EBE8DD",
          300: "#D6D2C4",
          400: "#A8A39A",
          500: "#6F6B61",
          600: "#4A463F",
          700: "#312E27",
          800: "#1F1D17",
          900: "#141310",
        },
        // Claude "book cloth" coral — Anthropic's signature accent.
        accent: {
          50: "#FBF1EC",
          100: "#F5DDD0",
          200: "#EBBCA4",
          300: "#E29A78",
          400: "#D9876A",
          500: "#D97757",
          600: "#CC785C",
          700: "#A85C44",
          800: "#7A4231",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightish: "-0.012em",
      },
    },
  },
  plugins: [],
};

export default config;
