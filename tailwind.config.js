/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "../public/**/*.html",
    "../public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#6366f1'
        }
      }
    }
  },
  plugins: []
};
