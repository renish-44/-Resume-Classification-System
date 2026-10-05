import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        /* Semantic tokens driven by CSS variables (see src/styles/index.css).
           Every one of them accepts opacity modifiers: bg-surface/70 */
        app: 'rgb(var(--c-app) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        content: 'rgb(var(--c-content) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        ink: {
          50: '#F5F7FB',
          100: '#E8ECF5',
          200: '#CFD7E7',
          300: '#A8B4CC',
          400: '#7C8AAA',
          500: '#5C6A88',
          600: '#445068',
          700: '#2F3950',
          800: '#1D2539',
          850: '#151C2C',
          900: '#0E1421',
          950: '#070A12',
        },
        brand: {
          50: '#EEF1FF',
          100: '#E0E5FF',
          200: '#C6CEFF',
          300: '#A3AEFF',
          400: '#8389FF',
          500: '#6A63F5',
          600: '#5A44E8',
          700: '#4A32CC',
          800: '#3D2AA6',
          900: '#342885',
        },
        aqua: {
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        mint: '#34D399',
        amber2: '#FBBF24',
        rose2: '#FB7185',
        sky2: '#38BDF8',
      },
      maxWidth: {
        content: '1200px',
      },
      borderRadius: {
        xl2: '1.125rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(106 99 245 / 0.25), 0 20px 60px -20px rgb(106 99 245 / 0.45)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 18px 40px -24px rgb(2 4 12 / 0.65)',
        lift: '0 24px 60px -30px rgb(2 4 12 / 0.75)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(120deg, #6A63F5 0%, #7C8FFF 35%, #22D3EE 100%)',
        'gradient-brand-soft':
          'linear-gradient(120deg, rgb(106 99 245 / 0.16) 0%, rgb(34 211 238 / 0.12) 100%)',
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
      keyframes: {
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'border-spin': {
          '0%': { transform: 'translateZ(0) rotate(0deg)' },
          '100%': { transform: 'translateZ(0) rotate(360deg)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'gradient-pan': 'gradient-pan 8s ease infinite',
        'border-spin': 'border-spin 8s linear infinite',
        shimmer: 'shimmer 1.8s infinite',
        float: 'float 6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
