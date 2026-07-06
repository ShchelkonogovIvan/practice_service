import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 24% 88%)",
        background: "hsl(210 30% 98%)",
        foreground: "hsl(220 32% 14%)",
        muted: "hsl(215 20% 46%)",
        primary: "hsl(213 84% 37%)",
        primarySoft: "hsl(211 82% 94%)",
        success: "hsl(155 64% 32%)"
      },
      boxShadow: {
        panel: "0 18px 45px rgb(15 23 42 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

