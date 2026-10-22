import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  /**
   * Dark mode is carried by `data-theme="dark"` on <html>, not a class.
   *
   * An attribute is the safer carrier here: <html>'s className is computed on
   * the server (the two font variables), and a pre-paint script toggling a
   * class on that same string is how hydration class-mismatch warnings start.
   * An attribute written by that script is invisible to React's reconciler.
   *
   * Nearly all of the theming is done by the af-* tokens, which flip in CSS
   * without Tailwind knowing. This entry exists for the handful of things a
   * token cannot express — blend modes, veil opacities, a filter on the hero
   * video — which need a real `dark:` variant.
   */
  darkMode: ["selector", '[data-theme="dark"]'],
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

        // Agent Farmer app palette — used by the app pages.
        //
        // Driven by CSS variables so the palette can be re-themed wholesale:
        // globals.css declares the light values on :root and the dark ones
        // under [data-theme="dark"]. Nothing here changes between themes, which
        // is the point — markup never learns which theme it is in.
        af: {
          primary: 'rgb(var(--af-primary) / <alpha-value>)',       // CTAs, active nav, success
          // What goes ON a primary fill. White in light (9.3:1 on #284D35);
          // the page ground in dark, because white on the brightened forest
          // #5FBF82 is 2.3:1 and unreadable. Never write text-white on a
          // primary surface — that is the one thing a theme flip cannot fix.
          'on-primary': 'rgb(var(--af-on-primary) / <alpha-value>)',
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

        // Marketing palette (landing / team / about). Redesign v2 — these
        // resolve to the same greens as the af-* app tokens, so the site and
        // the product look like one company. Names unchanged.
        //
        // Now variable-driven for the same reason af-* is: the public pages
        // are in scope for dark mode, and a literal hex cannot follow a theme.
        // Light values are declared in globals.css and are byte-identical to
        // the hexes that used to live here.
        'of-bg': 'rgb(var(--of-bg) / <alpha-value>)',             // the page ground
        'of-bg-2': 'rgb(var(--of-bg-2) / <alpha-value>)',         // alt band
        'of-surface': 'rgb(var(--of-surface) / <alpha-value>)',   // cards
        'of-ink': 'rgb(var(--of-ink) / <alpha-value>)',           // headings
        'of-body': 'rgb(var(--of-body) / <alpha-value>)',         // body text
        'of-muted': 'rgb(var(--of-muted) / <alpha-value>)',       // captions
        'of-border': 'rgb(var(--of-border) / <alpha-value>)',     // hairlines
        'of-primary': 'rgb(var(--of-primary) / <alpha-value>)',   // CTAs
        'of-primary-deep': 'rgb(var(--of-primary-deep) / <alpha-value>)',
        'of-forest': 'rgb(var(--of-forest) / <alpha-value>)',     // dark bands
        'of-blue': 'rgb(var(--of-blue) / <alpha-value>)',         // AI accents only
        'of-slate': 'rgb(var(--of-slate) / <alpha-value>)',       // warm neutral
        'of-sage': 'rgb(var(--of-sage) / <alpha-value>)',
        'of-mustard': 'rgb(var(--of-mustard) / <alpha-value>)',
        'of-earth': 'rgb(var(--of-earth) / <alpha-value>)',

        // Arva — pastoral editorial palette (landing page). Same treatment.
        // `vivid-lime` is the one that does NOT move: it was already a
        // dark-native accent, and it is the page's whole character.
        // forest-ink does double duty in the Arva layout: TYPE on a light
        // surface, and the fill of the big forest BANDS. Those invert in
        // opposite directions on dark — type has to brighten, a band has to
        // stay a band — so the band got its own token rather than one of them
        // being wrong. Light values are identical, so nothing moved.
        'forest-ink': 'rgb(var(--arva-forest-ink) / <alpha-value>)',
        'arva-band': 'rgb(var(--arva-band) / <alpha-value>)',
        'vivid-lime': '#e8fe85',
        'bone': 'rgb(var(--arva-bone) / <alpha-value>)',
        'pure-white': 'rgb(var(--arva-pure-white) / <alpha-value>)',
        'ash-gray': 'rgb(var(--arva-ash-gray) / <alpha-value>)',
        'charcoal': 'rgb(var(--arva-charcoal) / <alpha-value>)',
        'graphite': 'rgb(var(--arva-graphite) / <alpha-value>)',
        'pewter': 'rgb(var(--arva-pewter) / <alpha-value>)',
        'sky-card': 'rgb(var(--arva-sky-card) / <alpha-value>)',
        'peach-card': 'rgb(var(--arva-peach-card) / <alpha-value>)',
        'sage-card': 'rgb(var(--arva-sage-card) / <alpha-value>)',
        'moss': 'rgb(var(--arva-moss) / <alpha-value>)',

        // Bklit chart registry: one utility class its components use
        // (`text-chart-label`). The rest of their colour comes from raw CSS
        // variables, which need no Tailwind entry. See globals.css.
        'chart-label': 'var(--chart-label)',

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
        //
        // The values live in globals.css so dark mode can change the whole
        // strategy (a tinted drop shadow is invisible on near-black; dark
        // uses an inset top highlight instead) without a single call site
        // moving. `shadow-af-sm` is on hundreds of screens — it must stay one
        // utility that means "resting surface", whatever that takes to draw.
        'af-sm': 'var(--af-shadow-sm)',
        'af-md': 'var(--af-shadow-md)',
        'af-float': 'var(--af-shadow-float)',
        'of-card': 'var(--of-shadow-card)',
        'of-float': 'var(--of-shadow-float)',
        'of-nav': 'var(--of-shadow-nav)',
        'of-glow': 'var(--of-shadow-glow)',
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
