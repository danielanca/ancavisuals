module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
      minWidth: {
        40: "10rem",
        60: "15rem",
        80: "20rem",
        100: "25rem",
      },
      maxWidth: {
        120: "30rem",
        160: "40rem",
        200: "50rem",
      },
    },
  },
  variants: {},
  plugins: [],
};
