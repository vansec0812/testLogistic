/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#36a6f6',
          500: '#0c87eb',
          600: '#006ac9',
          700: '#0155a3',
          800: '#054885',
          900: '#0a3d6f',
          950: '#062649',
        },
        navy: {
          950: '#070d18',
          900: '#0c1626',
          850: '#111f36',
          800: '#162846',
          700: '#1f3860',
          600: '#2c4e85',
        },
        safety: {
          amber: '#f59e0b',
          emerald: '#10b981',
          crimson: '#ef4444',
          cyan: '#06b6d4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

