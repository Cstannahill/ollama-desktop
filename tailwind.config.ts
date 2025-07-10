import type { Config } from 'tailwindcss'
import animate from "tailwindcss-animate";
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--c-bg-primary)',
        'bg-surface': 'var(--c-bg-surface)',
        accent: 'var(--c-accent)',
        switch: 'var(--switch-accent)',
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
      },
      spacing: {
        xxs: '0.25rem',
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        xxl: '3rem',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        xxl: '1.5rem',
      },
      zIndex: {
        dropdown: '50',
        modal: '100',
        toast: '1000',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [animate],
} satisfies Config
