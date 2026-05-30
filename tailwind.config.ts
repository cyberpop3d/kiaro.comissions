import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Inter Tight', 'Arial Narrow', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        kiaro: {
          bg: '#070908',
          panel: '#111514',
          panel2: '#171b1a',
          line: '#2a2e2d',
          text: '#f3f4ef',
          muted: '#8d948d',
          neon: '#f4f3ec',
          pink: '#e8e4d7',
          lime: '#d8f0a0'
        }
      },
      boxShadow: {
        glow: '0 0 34px rgba(244, 243, 236, 0.10)',
        soft: '0 18px 80px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
};

export default config;
