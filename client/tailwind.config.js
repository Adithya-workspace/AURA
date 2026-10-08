/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F3EBE1',
        surface: '#FFF8F1',
        subtle: '#E9DFD2',
        border: '#E0D2C3',
        text: '#1B3A4B',
        muted: '#5E7380',
        accent: '#E07A4C',
        success: '#2F9E44',
        warning: '#E8890C',
        critical: '#E03131',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
