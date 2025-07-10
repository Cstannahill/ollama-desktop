import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-app': '#0b0b09',
        'bg-panel': '#1b1916',
        accent: '#fbcd14',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
