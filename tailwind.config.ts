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
        soft: "0 18px 60px rgba(28, 47, 67, 0.10)",
        line: "0 1px 0 rgba(28, 47, 67, 0.08)"
      },
      fontFamily: {
        sans: [
          "Inter",
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
