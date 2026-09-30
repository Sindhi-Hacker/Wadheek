import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Every color below resolves to a CSS custom property declared in
 * src/styles/globals.css (:root for light, .dark for dark). Components must
 * only use these semantic utilities — never raw palette classes.
 */
const config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
          foreground: "hsl(var(--panel-foreground))",
        },
        timeline: {
          DEFAULT: "hsl(var(--timeline-bg))",
          ruler: "hsl(var(--ruler-bg))",
        },
        "track-clip": {
          DEFAULT: "hsl(var(--track-clip))",
          foreground: "hsl(var(--track-clip-foreground))",
        },
        "track-audio": {
          DEFAULT: "hsl(var(--track-audio))",
          foreground: "hsl(var(--track-audio-foreground))",
        },
        "track-text": {
          DEFAULT: "hsl(var(--track-text))",
          foreground: "hsl(var(--track-text-foreground))",
        },
        "track-overlay": {
          DEFAULT: "hsl(var(--track-overlay))",
          foreground: "hsl(var(--track-overlay-foreground))",
        },
        playhead: "hsl(var(--playhead))",
        "grid-line": "hsl(var(--grid-line))",
        waveform: "hsl(var(--waveform))",
        "snap-guide": "hsl(var(--snap-guide))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "elevation-1": "var(--shadow-1)",
        "elevation-2": "var(--shadow-2)",
        "elevation-3": "var(--shadow-3)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-normal) ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
