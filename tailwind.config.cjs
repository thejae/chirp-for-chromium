/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  important: true,
  theme: {
    extend: {
      fontSize: {
        xxs: ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        wiggle: {
          '0%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(6deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'ping-sm': {
          '0%': { transform: 'scale(1)', opacity: 0.6 },
          '70%': { transform: 'scaleY(1.35) scaleX(1.06)', opacity: 0 },
          '100%': { transform: 'scaleY(1.35) scaleX(1.06)', opacity: 0 },
        },
        popup: {
          '0%': { opacity: 0, transform: 'scale(0.96) translateY(4px)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        wiggle: 'wiggle 0.25s cubic-bezier(0.22, 1, 0.36, 1) 1',
        'ping-sm': 'ping-sm 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        popup: 'popup 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
