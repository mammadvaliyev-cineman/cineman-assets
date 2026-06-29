import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          violet:  '#9765E0',
          lavender:'#CE95FB',
          teal:    '#00C2BA',
          indigo:  '#534FA5',
          deep:    '#36009C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #9765E0 0%, #534FA5 100%)',
        'brand-gradient-teal': 'linear-gradient(135deg, #9765E0 0%, #00C2BA 100%)',
      },
    },
  },
  plugins: [],
}

export default config
