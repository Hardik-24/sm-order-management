import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1a1a1a',
          'dark-secondary': '#2d2d2d',
          light: '#faf8f5',
          card: '#ffffff',
          primary: '#1a5c4c',
          'primary-hover': '#164d40',
          mint: '#4ecdc4',
          cream: '#e8e0d4',
        },
        border: {
          light: '#e5e2dc',
          dark: '#3a3a3a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
