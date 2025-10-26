/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif']
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // New neon colors
        neon: {
          blue: "hsl(210, 100%, 60%)",
          purple: "hsl(270, 100%, 60%)",
          pink: "hsl(330, 100%, 60%)",
          green: "hsl(150, 100%, 60%)",
          cyan: "hsl(180, 100%, 60%)",
          yellow: "hsl(60, 100%, 60%)",
        },
        // Gradient colors
        gradient: {
          start: "hsl(210, 100%, 50%)",
          end: "hsl(270, 100%, 50%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: 1,
            boxShadow: "0 0 15px 5px rgba(var(--primary-rgb), 0.5)",
          },
          "50%": {
            opacity: 0.8,
            boxShadow: "0 0 25px 10px rgba(var(--primary-rgb), 0.7)",
          },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "ripple": {
          "0%": { transform: "scale(0)", opacity: 0.5 },
          "100%": { transform: "scale(2)", opacity: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.4s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "ripple": "ripple 0.8s ease-out",
      },
      boxShadow: {
        'neon': '0 0 10px rgba(var(--primary-rgb), 0.7), 0 0 20px rgba(var(--primary-rgb), 0.5), 0 0 30px rgba(var(--primary-rgb), 0.3)',
        'neon-sm': '0 0 5px rgba(var(--primary-rgb), 0.7), 0 0 10px rgba(var(--primary-rgb), 0.5)',
        'glass': '0 4px 24px 0 rgba(0, 0, 0, 0.05)',
        'glass-dark': '0 4px 24px 0 rgba(0, 0, 0, 0.2)',
      },
      backdropFilter: {
        'glass': 'blur(10px) saturate(180%)',
      },
    },
  },
  plugins: [],
} 