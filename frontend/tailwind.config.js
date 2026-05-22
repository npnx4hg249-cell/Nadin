/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff4ff',
          100: '#dce5ff',
          200: '#b9cbff',
          300: '#8da6ff',
          400: '#6080ff',
          500: '#3a58f8',
          600: '#2640ea',
          700: '#1c30cc',
          800: '#1b2da5',  // primary navy — matches logo N body
          900: '#1a2880',  // deep navy — logo dark
          950: '#111847',
        },
        // Keep a navy alias for sidebar/structural use
        navy: {
          700: '#1e2e72',
          800: '#172466',
          900: '#111b50',
          950: '#0c1238',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
