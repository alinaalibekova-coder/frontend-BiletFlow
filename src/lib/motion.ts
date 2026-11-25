// Smooth scrolling only for people who have not asked the system for reduced motion.
export const scrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
