/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--c-bg) / <alpha-value>)",
        surface: "hsl(var(--c-surface) / <alpha-value>)",
        "surface-2": "hsl(var(--c-surface-2) / <alpha-value>)",
        "surface-offset": "hsl(var(--c-surface-offset) / <alpha-value>)",
        border: "hsl(var(--c-border) / <alpha-value>)",
        divider: "hsl(var(--c-divider) / <alpha-value>)",
        text: "hsl(var(--c-text) / <alpha-value>)",
        "text-muted": "hsl(var(--c-text-muted) / <alpha-value>)",
        "text-faint": "hsl(var(--c-text-faint) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--c-primary) / <alpha-value>)",
          hover: "hsl(var(--c-primary-hover) / <alpha-value>)",
          active: "hsl(var(--c-primary-active) / <alpha-value>)",
        },
        success: "hsl(var(--c-success) / <alpha-value>)",
        warning: "hsl(var(--c-warning) / <alpha-value>)",
        error: "hsl(var(--c-error) / <alpha-value>)",
        blue: "hsl(var(--c-blue) / <alpha-value>)",
        purple: "hsl(var(--c-purple) / <alpha-value>)",
        gold: "hsl(var(--c-gold) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Satoshi", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Cabinet Grotesk", "Satoshi", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        sm: "var(--sh-sm)",
        md: "var(--sh-md)",
        lg: "var(--sh-lg)",
      },
    },
  },
  plugins: [],
};
