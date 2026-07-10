import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        sidebar: "hsl(var(--sidebar) / <alpha-value>)",
        sidebarForeground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
        sidebarMuted: "hsl(var(--sidebar-muted) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.08)",
        lift: "0 18px 60px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
