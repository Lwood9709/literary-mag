/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oat: '#f7f7f4',
        forest: { DEFAULT: '#2f3a32', soft: '#4a564c' },
        sage: { DEFAULT: '#6b8f71', dark: '#54745b', light: '#e7efe7' },
        blush: { DEFAULT: '#d8a7a1', light: '#f4e6e3', dark: '#a86a62' },
        muted: '#8a948b',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
