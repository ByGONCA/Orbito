/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic Theme Variables (Glass default, Solid alternative)
        background: 'var(--background)',
        'background-deep': 'var(--background-deep)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        highlight: 'var(--highlight)',
        foreground: 'var(--foreground)',
        'foreground-secondary': 'var(--foreground-secondary)',
        'foreground-muted': 'var(--foreground-muted)',
        
        // Brand Accent (Strict Neutral / Monochrome Apple Style)
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          border: 'var(--accent-border)',
          foreground: '#101216'
        },

        // Semantic states (Restrained)
        success: {
          DEFAULT: '#34D399',
          subtle: 'rgba(52, 211, 153, 0.12)',
          border: 'rgba(52, 211, 153, 0.28)'
        },
        error: {
          DEFAULT: '#F87171',
          subtle: 'rgba(248, 113, 113, 0.12)',
          border: 'rgba(248, 113, 113, 0.28)'
        },
        warning: {
          DEFAULT: '#FBBF24',
          subtle: 'rgba(251, 191, 36, 0.12)',
          border: 'rgba(251, 191, 36, 0.28)'
        },
        info: {
          DEFAULT: '#60A5FA',
          subtle: 'rgba(96, 165, 250, 0.12)',
          border: 'rgba(96, 165, 250, 0.28)'
        },

        // Legacy / Component Compatibility Aliases
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--foreground)'
        },
        popover: {
          DEFAULT: 'var(--surface-elevated)',
          foreground: 'var(--foreground)'
        },
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: '#111317'
        },
        secondary: {
          DEFAULT: 'var(--surface-elevated)',
          foreground: 'var(--foreground)'
        },
        muted: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--foreground-muted)'
        },
        input: 'var(--surface)',
        ring: 'var(--accent)'
      },
      backdropBlur: {
        glass: '16px',
        'glass-sm': '8px',
        'glass-lg': '24px'
      },
      borderRadius: {
        '2xl': '16px',
        xl: '12px',
        lg: '10px',
        md: '8px',
        sm: '6px',
        xs: '4px'
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.35)',
        panel: '0 4px 16px 0 rgba(0, 0, 0, 0.45)',
        dropdown: '0 8px 24px -4px rgba(0, 0, 0, 0.55), 0 2px 6px -1px rgba(0, 0, 0, 0.35)',
        glow: '0 0 16px -2px rgba(255, 255, 255, 0.06)'
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      }
    }
  },
  plugins: []
}
