/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf4ee',
          100: '#fae5d3',
          200: '#f4c9a0',
          300: '#eda56a',
          400: '#e67e38',
          500: '#c0601a',
          600: '#9e4d13',
          700: '#7c3b0e',
          800: '#5c2b0a',
          900: '#3d1c06',
        },
      },
    },
  },
  plugins: [],
}
