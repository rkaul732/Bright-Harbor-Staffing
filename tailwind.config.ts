import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        harbor: {
          sky: "#4BA0D8",
          ocean: "#346990",
          lemon: "#f7f5ac",
          mist: "#eef5fb",
          midnight: "#1c2f43"
        }
      },
      boxShadow: {
        soft: "0 22px 60px -32px rgba(28, 47, 67, 0.35), 0 6px 18px -12px rgba(28, 47, 67, 0.14)",
        line: "0 1px 2px rgba(28, 47, 67, 0.05), 0 10px 28px -24px rgba(28, 47, 67, 0.28)",
        lift: "0 28px 72px -36px rgba(28, 47, 67, 0.42)"
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "DM Sans",
          "Aptos",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
