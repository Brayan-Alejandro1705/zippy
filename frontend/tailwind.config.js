/** @type {import('tailwindcss').Config} */
// Tailwind convive con los .css que ya tiene la app:
// - preflight apagado: si no, resetea margenes, botones y titulos de TODAS
//   las pantallas viejas de golpe.
// - el modo oscuro usa la misma clase .dark-theme que pone ThemeContext en
//   el <body>, asi "dark:bg-slate-800" funciona con el boton de tema actual.
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: ['selector', '.dark-theme'],
  corePlugins: { preflight: false },
  // Las clases de Tailwind llevan "#root" delante para ganarle a los .css
  // viejos que se cargan despues (mismo peso, el ultimo gana). Asi una
  // pantalla se puede pasar a Tailwind sin pelear con su hoja anterior.
  important: '#root',
  theme: {
    // Orden de menor a mayor: si "xs" quedara de ultimo, ganaria en escritorio.
    // xs = Android pequeno en adelante (360 px); por debajo es 320-359.
    screens: { xs: '360px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        zippy: {
          50: '#fff8f0',
          100: '#ffedd9',
          200: '#ffd6ad',
          DEFAULT: '#FF7A00',
          500: '#FF7A00',
          600: '#e56d00',
          700: '#c45d00',
        },
        // Fondos del modo oscuro que ya usa la app
        noche: { DEFAULT: '#0f172a', card: '#1e293b', borde: '#334155', alt: '#273548' },
      },
      padding: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
