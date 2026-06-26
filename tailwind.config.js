/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          light: '#e8f0e8',
          DEFAULT: '#b8cdb8',
          dark: '#6a8f6a',
        },
        sand: {
          light: '#f0ebe2',
          DEFAULT: '#d4c9b8',
        },
        peach: {
          light: '#f5e8de',
          DEFAULT: '#e8c4b0',
        },
        sky: {
          light: '#e2edf5',
          DEFAULT: '#b0c8d8',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
