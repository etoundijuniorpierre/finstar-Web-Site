/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
    './src/**/*.component.{html,ts}',
    './src/**/*.directive.{html,ts}',
    './src/**/*.pipe.{html,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFD60099',
        secondary: '#FF6CAB'
      },
      fontFamily: {
        sans: ['Instrument Sans', 'Arial', 'sans-serif'],
        instrument: ['Instrument Sans', 'Arial', 'sans-serif'],
        'instrument-sans': ['Instrument Sans', 'Arial', 'sans-serif']
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      fontSize: {
        128: '5.75rem'
      },
      borderRadius: {
        '4xl': '2rem'
      },
      accent: {
        accentColor: '#000000',
        accentColorSecondary: '#FFD600',
        accentColorTertiary: '#FF6CAB'
      },
      background: {
        backgroundColor: '#ffffff',
        backgroundColorSecondary: '#000000'
      },
      borderColor: {
        borderColor: '#000000',
        borderColorSecondary: '#FFD600',
        borderColorTertiary: '#FF6CAB'
      },
      gradient: {
        gradientColor: 'linear-gradient(90deg, #FFD600 0%, #FF6CAB 100%)'
      },
      boxShadow: {
        custom: '0 2px 12px 0 #FFD60099'
      }
    }
  },
  plugins: []
};
