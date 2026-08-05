// Shared Tailwind CDN config for every page — keeps utility classes in sync
// with the design tokens defined in css/theme.css.
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#7c5cff',
        'primary-hover': '#9276ff',
        accent: '#ffb020',
        danger: '#ff4d6d',
        'background-light': '#f8f6f7',
        'background-dark': '#08080c',
        'surface-dark': '#14141f',
        'surface-dark-2': '#1c1c2b',
      },
      fontFamily: {
        display: ['Bebas Neue', 'Be Vietnam Pro', 'sans-serif'],
        body: ['Be Vietnam Pro', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
    },
  },
};
