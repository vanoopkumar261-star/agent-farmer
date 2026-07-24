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
        af: {
          primary: '#10B981',       // Rich Emerald — CTAs, active nav, success, AI highlights
          'primary-deep': '#0F9D58',
          secondary: '#064E3B',     // Forest — headers, large sections
          leaf: '#66BB6A',          // Fresh Leaf — hover, icons
          sage: '#DCEFD8',          // Soft accent — card tints
          ai: '#3B82F6',            // AI blue — insights, chat, confidence
          'ai-soft': '#EAF3FF',
          neutral: '#64748B',
          bg: '#FAFBF8',            // Warm off-white — never pure white
          card: '#FFFFFF',
          border: '#E4E9E3',
          ink: '#1B1B1B',           // Primary text
          'ink-2': '#616161',       // Secondary text
          muted: '#8A8A8A',         // Muted text
          amber: '#F4B400',         // Warning
          danger: '#D93025',        // Error
        },

        // Agent Farmer OS — modern light palette (landing / team / about re-theme).
        'of-bg': '#F4F7F5',        // airy canvas
        'of-bg-2': '#EAF1ED',      // slightly deeper alt band
        'of-surface': '#FFFFFF',   // cards
        'of-ink': '#0C1A14',       // headings — deep forest-ink
        'of-body': '#44514D',      // body text
        'of-muted': '#8FA39C',     // muted / captions
        'of-border': '#E2EAE6',    // hairlines
        'of-primary': '#10B981',   // rich emerald
        'of-primary-deep': '#0E9E74',
        'of-forest': '#064E3B',    // secondary / dark bands
        'of-blue': '#3B82F6',      // tertiary / AI accents
        'of-slate': '#64748B',     // neutral

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
        sans: ['var(--font-plus-jakarta)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        // Arva editorial pairing
        inter: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        reckless: ['var(--font-cormorant)', 'Georgia', 'Cambria', 'serif'],
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
        // Apple-style soft shadows for the light app cards
        'af-sm': '0 1px 2px rgba(16,24,20,0.04), 0 1px 3px rgba(16,24,20,0.06)',
        'af-md': '0 4px 12px rgba(16,24,20,0.05), 0 2px 6px rgba(16,24,20,0.04)',
        'af-float': '0 12px 32px rgba(16,24,20,0.08), 0 4px 12px rgba(16,24,20,0.05)',
        // OS re-theme — emerald-tinted depth
        'of-card': '0 1px 2px rgba(6,78,59,0.04), 0 8px 24px rgba(6,78,59,0.06)',
        'of-float': '0 20px 50px rgba(6,78,59,0.10), 0 6px 16px rgba(6,78,59,0.06)',
        'of-nav': '0 10px 34px rgba(6,78,59,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
        'of-glow': '0 0 0 1px rgba(16,185,129,0.16), 0 14px 40px rgba(16,185,129,0.16)',
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
