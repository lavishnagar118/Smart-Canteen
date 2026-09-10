/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          500: "#f97316",
          600: "#ea580c",
          900: "#431407",
        },
      },
      boxShadow: {
        soft: "0 12px 30px rgba(67, 20, 7, 0.08)",
      },
    },
  },
  plugins: [],
};
