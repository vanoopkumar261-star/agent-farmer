import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8f9ff',
        'on-background': '#0b1c30',
        primary: '#005136',
        'on-primary': '#ffffff',
        'primary-container': '#006c49',
        'on-primary-container': '#93eabe',
        secondary: '#2b6954',
        'on-secondary': '#ffffff',
        'secondary-container': '#b0f0d5',
        'on-secondary-container': '#326f5a',
        tertiary: '#004394',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#005ac2',
        'on-tertiary-container': '#c9d8ff',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        surface: '#f8f9ff',
        'surface-dim': '#cbdbf5',
        'surface-bright': '#f8f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#3f4943',
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',
        outline: '#6f7a72',
        'outline-variant': '#bec9c0',
        'leaf-success': '#10b981',
        'sky-info': '#3b82f6',
        'alert-warning': '#ba1a1a',

        // Official Agent Farmer light theme (Theme Guide v1.0) — used by the app pages.
        //
        // Driven by CSS variables so the palette can be re-scoped per shell. The
        // :root defaults (globals.css) are the original emerald theme used by
        // /login and /onboarding; the dashboard shell overrides them with the
        // deeper "New version" forest palette. See globals.css → [data-shell="app"].
        af: {
          primary: 'rgb(var(--af-primary) / <alpha-value>)',       // CTAs, active nav, success
          'primary-deep': 'rgb(var(--af-primary-deep) / <alpha-value>)',
          secondary: 'rgb(var(--af-secondary) / <alpha-value>)',   // Forest — dark bands
          leaf: 'rgb(var(--af-leaf) / <alpha-value>)',             // Fresh Leaf — hover, icons
          sage: 'rgb(var(--af-sage) / <alpha-value>)',             // Soft accent — card tints
          beige: 'rgb(var(--af-beige) / <alpha-value>)',           // Warm beige — highlight tint
          ai: 'rgb(var(--af-ai) / <alpha-value>)',                 // AI blue — insights, chat
          'ai-soft': 'rgb(var(--af-ai-soft) / <alpha-value>)',
          neutral: 'rgb(var(--af-neutral) / <alpha-value>)',
          bg: 'rgb(var(--af-bg) / <alpha-value>)',                 // Warm off-white canvas
          card: 'rgb(var(--af-card) / <alpha-value>)',
          border: 'rgb(var(--af-border) / <alpha-value>)',
          ink: 'rgb(var(--af-ink) / <alpha-value>)',               // Primary text
          'ink-2': 'rgb(var(--af-ink-2) / <alpha-value>)',         // Secondary text
          muted: 'rgb(var(--af-muted) / <alpha-value>)',           // Muted text
          amber: 'rgb(var(--af-amber) / <alpha-value>)',           // Warning
          'amber-ink': 'rgb(var(--af-amber-ink) / <alpha-value>)', // readable mustard for type
          danger: 'rgb(var(--af-danger) / <alpha-value>)',         // Error
        },

        // Marketing palette (landing / team / about). Redesign v2 — these now
        // resolve to the same greens as the af-* app tokens in globals.css, so
        // the site and the product look like one company. Names unchanged.
        'of-bg': '#F7F6F0',        // Warm Ivory — the page ground
        'of-bg-2': '#F0EFE6',      // slightly deeper alt band
        'of-surface': '#FFFFFF',   // cards
        'of-ink': '#173B2A',       // Primary Forest — headings
        'of-body': '#3F5347',      // body text
        'of-muted': '#7C8A78',     // muted / captions
        'of-border': '#E3E4D9',    // sage-tinted hairlines
        'of-primary': '#284D35',   // Deep Green — CTAs, accents
        'of-primary-deep': '#173B2A',
        'of-forest': '#173B2A',    // dark bands
        'of-blue': '#4A6FA5',      // desaturated blue — AI accents only
        'of-slate': '#6E7A6B',     // warm neutral
        'of-sage': '#A9B99A',      // Sage — muted agricultural accent
        'of-mustard': '#D6A72C',   // Mustard — sparing highlight
        'of-earth': '#8B7355',     // Earth Brown — soil/organic accents

        // Arva — pastoral editorial palette (landing page).
        'forest-ink': '#07503f',
        'vivid-lime': '#e8fe85',
        'bone': '#f1efdf',
        'pure-white': '#ffffff',
        'ash-gray': '#efefef',
        'charcoal': '#212529',
        'graphite': '#353535',
        'pewter': '#6d6d6d',
        'sky-card': '#b2cee7',
        'peach-card': '#fceace',
        'sage-card': '#e6ecd5',
        'moss': '#c3cda7',

        // Dark HUD/terminal theme — landing page only.
        'hud-bg': '#050806',
        'hud-bg-alt': '#080f0b',
        'hud-surface': '#0a1310',
        'hud-panel': 'rgba(255,255,255,0.035)',
        'hud-border': 'rgba(255,255,255,0.09)',
        'hud-border-strong': 'rgba(255,255,255,0.16)',
        'hud-green': '#39ffb0',
        'hud-green-dim': '#1e8f6b',
        'hud-blue': '#4c9eff',
        'hud-amber': '#ffb454',
        'hud-red': '#ff6b6b',
        'hud-text': '#eafaf2',
        'hud-text-dim': 'rgba(234,250,242,0.58)',
        'hud-text-faint': 'rgba(234,250,242,0.34)',
      },
      fontFamily: {
        // Redesign v2 — Inter carries the whole product. It was already in the
        // bundle (the architecture page used it), so this costs no new request.
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // JetBrains Mono stays for the small uppercase metadata labels, which
        // appear on nearly every card and are part of this product's character.
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        inter: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        reckless: ['Georgia', 'Cambria', 'serif'],
      },
      // Display scale for the redesign. Existing pages use arbitrary sizes, so
      // these are additive — sections adopt them as they are restyled.
      fontSize: {
        'display-xl': ['clamp(42px, 6vw, 88px)', { lineHeight: '1.03', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(36px, 4.6vw, 64px)', { lineHeight: '1.06', letterSpacing: '-0.032em' }],
        'display-md': ['clamp(30px, 3.4vw, 48px)', { lineHeight: '1.12', letterSpacing: '-0.028em' }],
        'heading': ['clamp(22px, 2.2vw, 28px)', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'body-lg': ['18px', { lineHeight: '1.65' }],
        'body': ['16px', { lineHeight: '1.65' }],
        'meta': ['13px', { lineHeight: '1.5' }],
        'label': ['11px', { lineHeight: '1.4', letterSpacing: '0.16em' }],
      },
      borderRadius: {
        sm: '0.5rem',     // 8px
        DEFAULT: '1rem',  // 16px
        md: '1.5rem',     // 24px
        lg: '2rem',       // 32px (Our Primary Bento Card Corner Radius)
        xl: '3rem',       // 48px
        // Arva named radii
        'arva-card': '20px',
        'arva-input': '33px',
        'arva-btn': '100px',
        'arva-nav': '110px',
        'arva-hero': '30px',
      },
      boxShadow: {
        'hud-glow-green': '0 0 0 1px rgba(57,255,176,0.15), 0 8px 40px rgba(57,255,176,0.10)',
        'hud-glow-blue': '0 0 0 1px rgba(76,158,255,0.15), 0 8px 40px rgba(76,158,255,0.10)',
        // Forest-tinted depth. Redesign v2 keeps these deliberately faint —
        // the direction calls for subtle borders over heavy shadows.
        'af-sm': '0 1px 2px rgba(23,59,42,0.04), 0 1px 3px rgba(23,59,42,0.05)',
        'af-md': '0 2px 8px rgba(23,59,42,0.05), 0 1px 3px rgba(23,59,42,0.04)',
        'af-float': '0 10px 28px rgba(23,59,42,0.07), 0 3px 10px rgba(23,59,42,0.04)',
        'of-card': '0 1px 2px rgba(23,59,42,0.04), 0 8px 24px rgba(23,59,42,0.05)',
        'of-float': '0 18px 44px rgba(23,59,42,0.09), 0 5px 14px rgba(23,59,42,0.05)',
        'of-nav': '0 8px 28px rgba(23,59,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
        'of-glow': '0 0 0 1px rgba(23,59,42,0.12), 0 12px 32px rgba(23,59,42,0.12)',
      },
      keyframes: {
        'hud-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'hud-scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'af-shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'af-ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'af-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(40px, 30px, 0) scale(1.15)' },
        },
        'af-drift-2': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1.1)' },
          '50%': { transform: 'translate3d(-50px, 24px, 0) scale(1)' },
        },
        'af-sheen': {
          '0%': { transform: 'translateX(-140%) skewX(-14deg)' },
          '60%, 100%': { transform: 'translateX(240%) skewX(-14deg)' },
        },
        'af-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      animation: {
        'hud-blink': 'hud-blink 1s step-end infinite',
        'hud-scan': 'hud-scan 3s linear infinite',
        'af-shimmer': 'af-shimmer 1.6s infinite',
        'af-ticker': 'af-ticker 30s linear infinite',
        'af-drift': 'af-drift 26s ease-in-out infinite',
        'af-drift-2': 'af-drift-2 32s ease-in-out infinite',
        'af-sheen': 'af-sheen 7s ease-in-out infinite',
        'af-float': 'af-float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
