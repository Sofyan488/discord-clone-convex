import type { Config } from "tailwindcss";

// Discord-like dark palette as design tokens (no component library; Tailwind only).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: "#313338", // main chat background
          sidebar: "#2b2d31", // channel sidebar
          rail: "#1e1f22", // server rail
          member: "#2b2d31", // member list
          accent: "#5865f2", // blurple
          online: "#23a55a",
          offline: "#80848e",
          danger: "#da373c",
          text: "#dbdee1",
          muted: "#949ba4",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
