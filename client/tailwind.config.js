export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#DC2626', light: '#EF4444', dark: '#B91C1C' },
        secondary: { DEFAULT: '#2563EB', light: '#3B82F6', dark: '#1D4ED8' },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
