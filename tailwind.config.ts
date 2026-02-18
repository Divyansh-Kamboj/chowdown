import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        borderRadius: {
            DEFAULT: "0px",
            sm: "0px",
            md: "0px",
            lg: "0px",
            xl: "0px",
            "2xl": "0px",
            "3xl": "0px",
            full: "0px",
        },
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                void: "#050505",
                "neon-purple": "#d946ef",
                acid: "#ccff00",
            },
            boxShadow: {
                hard: "4px 4px 0px 0px #d946ef",
            },
            fontFamily: {
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Monaco",
                    "Consolas",
                    "Liberation Mono",
                    "Courier New",
                    "monospace",
                ],
            },
            animation: {
                shine: "shine 1s",
            },
            keyframes: {
                shine: {
                    "100%": { left: "125%" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
