import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeUp, IN_VIEW } from '@/lib/motion';
import { cn } from '@/lib/cn';

export interface RevealProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}

/**
 * Scroll-reveal wrapper. Falls back to an instant, visible render when the
 * user prefers reduced motion.
 */
export function Reveal({ children, delay = 0, y = 22, className }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={IN_VIEW}
      variants={fadeUp}
      transition={{ delay }}
    >
      <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={IN_VIEW}>
        {children}
      </motion.div>
    </motion.div>
  );
}

export interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

/** Reveals direct children one after another. */
export function Stagger({ children, className, stagger = 0.08 }: StaggerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={IN_VIEW}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

/** Child of <Stagger>. */
export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
