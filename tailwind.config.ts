import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: '#050510',
        midnight: '#0A0F2E',
        steel: '#1A2744',
        dusty: '#3B5998',
        moonlit: '#7EB8E0',
        ice: '#C8E0FF',
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
