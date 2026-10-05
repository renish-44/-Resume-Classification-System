import type { Transition, Variants } from 'framer-motion';

/** Shared cubic-bezier for every entrance animation (fast out, gentle settle). */
export const EASE_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 26 };

/** `whileInView` config shared by scroll-reveal wrappers. */
export const IN_VIEW = { once: true, amount: 0.2, margin: '0px 0px -60px 0px' } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_EXPO } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.45, ease: EASE_EXPO } },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: EASE_EXPO } },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: EASE_EXPO } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE_EXPO } },
};

/** Parent that staggers its children's entrance. */
export function staggerContainer(stagger = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Path-drawing style reveal for the animated gradient border on CTAs. */
export const drawLine: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 1.1, ease: EASE_EXPO } },
};
