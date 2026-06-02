export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: { 850: '#1a2332' },
        brand: {
          50: '#f0f4ff', 100: '#e0eaff', 200: '#c7d7fe',
          500: '#4f7bf7', 600: '#3b5fe2', 700: '#2d4ac7',
          800: '#1e3490', 900: '#172567',
        },
        gold: { 400: '#d4a017', 500: '#b8860b' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
