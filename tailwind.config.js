import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Inter var", ...defaultTheme.fontFamily.sans]
      },
      colors: {
        tiba: {
          blue: "#1d4699",
          gold: "#c5a044"
        },
        brand: {
          25: "#f8f9ff",
          50: "#f3f5ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          650: "#4338ca",
          700: "#3730a3",
          800: "#312e81",
          900: "#1e1b4b"
        },
        accent: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488"
        },
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5f5",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a"
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a"
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#facc15",
          500: "#eab308"
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626"
        }
      },
      boxShadow: {
        card: "0 20px 60px -25px rgba(15, 23, 42, 0.25)",
        elevated: "0 25px 65px -20px rgba(67, 56, 202, 0.25)",
        focus: "0 0 0 4px rgba(99, 102, 241, 0.25)"
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2.25rem",
        pill: "999px"
      },
      spacing: {
        15: "3.75rem",
        18: "4.5rem",
        30: "7.5rem"
      },
      transitionTimingFunction: {
        emphasized: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      },
      keyframes: {
        "pulse-subtle": {
          "0%,100%": { opacity: 1 },
          "50%": { opacity: 0.5 }
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        }
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite"
      },
      backgroundImage: {
        "brand-radial": "radial-gradient(circle at 20% 20%, rgba(79,70,229,0.22), rgba(14,165,233,0))",
        "brand-linear": "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 60%, #14b8a6 100%)",
        "glass-card": "linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.3) 100%)",
        "glass-dark": "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 100%)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: [require("./tailwind-scrollbar")({ nocompatible: true })]
};
