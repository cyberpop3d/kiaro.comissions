import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Orbitron', 'Rajdhani', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        kiaro: {
          bg: '#07090f',
          panel: '#10131d',
          panel2: '#151a27',
          line: '#232b3d',
          text: '#eef3ff',
          muted: '#8c98ad',
          neon: '#79f2ff',
          pink: '#ff4fd8',
          lime: '#b8ff64'
        }
      },
      boxShadow: {
        glow: '0 0 34px rgba(121, 242, 255, 0.18)',
        soft: '0 18px 80px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
};

export default config;
