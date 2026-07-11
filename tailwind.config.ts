import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#2A7F7F",
          dark: "#1E6B6B",
          light: "#B5D4D4",
          xlight: "#DCEAE4",
        },
        sage: {
          DEFAULT: "#8BB5A0",
          light: "#C5D9CB",
        },
        canvas: "#F7F4EF",
        white: "#FFFFFF",
        ink: {
          DEFAULT: "#2C2C2C",
          secondary: "#5F5E5A",
          hint: "#888780",
        },
        border: "rgba(0,0,0,0.08)",
        "border-light": "rgba(0,0,0,0.06)",
        accent: {
          DEFAULT: "#C9633E",
          light: "#FBE4D5",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        vxs: ["11px", { lineHeight: "1.6" }],
        vsm: ["13px", { lineHeight: "1.6" }],
        vbase: ["15px", { lineHeight: "1.6" }],
        vlg: ["18px", { lineHeight: "1.6" }],
        vxl: ["24px", { lineHeight: "1.3" }],
        v2xl: ["44px", { lineHeight: "1.1" }],
        v3xl: ["58px", { lineHeight: "1.05" }],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
        card: "20px",
      },
      spacing: {
        xs: "8px",
        sm: "14px",
        md: "24px",
        lg: "40px",
        xl: "56px",
      },
      borderColor: {
        hairline: "rgba(0,0,0,0.08)",
        "hairline-light": "rgba(0,0,0,0.06)",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
