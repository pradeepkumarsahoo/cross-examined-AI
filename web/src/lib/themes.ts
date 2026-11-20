// One formal palette for every page: navy ink, a single blue accent, flat fills. The six keys are kept
// so each route can still be given its own accent later without touching the components.

export interface PageTheme {
  /** Tailwind gradient stops for buttons, icon badges and bars */
  gradient: string;
  /** CSS gradient for gradient text and gradient borders, on the dark page */
  css: string;
  /** the same gradient in deeper steps, legible on the light page */
  cssLight: string;
  /** three aurora blob colours */
  aurora: [string, string, string];
  /** single-series chart colour */
  accent: string;
  /** small uppercase label above the page title */
  eyebrow: string;
  /** soft glow behind icon badges */
  glow: string;
}

export const THEMES = {
  aurora: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
  orchid: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
  ocean: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
  sunset: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
  lagoon: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
  nebula: {
    gradient: "from-blue-700 to-blue-700",
    css: "linear-gradient(0deg, #3b82f6, #3b82f6)",
    cssLight: "linear-gradient(0deg, #1d4ed8, #1d4ed8)",
    aurora: ["#1d4ed8", "#1d4ed8", "#1d4ed8"],
    accent: "#1d4ed8",
    eyebrow: "text-blue-700 dark:text-blue-300",
    glow: "shadow-sm",
  },
} satisfies Record<string, PageTheme>;

export type ThemeKey = keyof typeof THEMES;

/** Which colour story belongs to which route. */
export function themeForPath(pathname: string): ThemeKey {
  if (pathname.startsWith("/upload")) return "orchid";
  if (pathname.startsWith("/batches")) return "ocean";
  if (pathname.startsWith("/review")) return "sunset";
  if (pathname.startsWith("/export")) return "lagoon";
  if (pathname.startsWith("/monitoring")) return "nebula";
  return "aurora";
}
