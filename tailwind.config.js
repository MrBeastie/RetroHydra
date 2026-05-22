/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif']
      },
      colors: {
        hydra: {
          bg: '#0F0F0F',
          panel: '#17171A',
          line: '#26262D',
          accent: '#8B5CF6',
          cyan: '#22D3EE',
          green: '#34D399'
        }
      },
      boxShadow: {
        glow: '0 0 34px rgba(139, 92, 246, 0.28)'
      }
    }
  },
  plugins: []
};
