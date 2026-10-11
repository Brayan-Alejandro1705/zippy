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
      // Animaciones de las pantallas de entrada (login, registro, etc.)
      keyframes: {
        fondo: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        flotar: { '0%, 100%': { transform: 'translateY(0) scale(1)' }, '50%': { transform: 'translateY(-28px) scale(1.04)' } },
        aparecer: { from: { opacity: '0', transform: 'translateY(32px) scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        subir: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        desvanecer: { from: { opacity: '0' }, to: { opacity: '1' } },
        pulso: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,122,0,.35)' }, '50%': { boxShadow: '0 0 0 7px rgba(255,122,0,0)' } },
        sacudir: {
          '0%, 100%': { transform: 'translateX(0)' }, '15%': { transform: 'translateX(-8px)' }, '30%': { transform: 'translateX(8px)' },
          '45%': { transform: 'translateX(-5px)' }, '60%': { transform: 'translateX(5px)' }, '75%': { transform: 'translateX(-3px)' }, '90%': { transform: 'translateX(3px)' },
        },
      },
      animation: {
        fondo: 'fondo 12s ease infinite',
        flotar: 'flotar 8s ease-in-out infinite',
        aparecer: 'aparecer 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        sacudir: 'sacudir 0.5s ease',
        subir: 'subir 0.32s cubic-bezier(0.34, 1.1, 0.64, 1)',
        desvanecer: 'desvanecer 0.2s ease',
        pulso: 'pulso 1.8s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
