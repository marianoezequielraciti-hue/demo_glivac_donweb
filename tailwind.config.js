export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1E3A8A', light: '#2563EB', dark: '#1e3a8a' }
      },
      borderRadius: { lg: '0.625rem', md: '0.5rem', sm: '0.375rem' }
    },
  },
  plugins: [require('tailwindcss-animate')],
}
