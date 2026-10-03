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
      // h-screen / min-h-screen: a height the phone keyboard and browser bars cannot change
      // (`--stable-vh`, utils/stableViewport.ts) — otherwise everything below them jumps while typing.
      height: {
        screen: "calc(var(--stable-vh, 1vh) * 100)",
      },
      minHeight: {
        screen: "calc(var(--stable-vh, 1vh) * 100)",
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
