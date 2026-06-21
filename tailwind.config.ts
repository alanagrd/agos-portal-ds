import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        agos: {
          green: "#8BAB3E",
          orange: "#E87722",
          dark: "#1C1C1E",
          gray: "#3D3D3D",
        },
      },
    },
  },
  plugins: [],
};

export default config;
