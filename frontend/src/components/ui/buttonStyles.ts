import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-brand text-white shadow-glow hover:brightness-110 active:brightness-95 border border-transparent',
  secondary: 'glass text-content hover:border-brand-400/60 hover:bg-surface/85 active:bg-surface',
  outline: 'border border-brand-400/45 text-content hover:border-brand-400 hover:bg-brand-500/10',
  ghost: 'text-muted hover:text-content hover:bg-elevated/70',
  danger: 'bg-rose2/15 text-rose2 border border-rose2/35 hover:bg-rose2/25',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] gap-2.5 rounded-2xl',
};

/**
 * Shared class recipe so router links, anchors and buttons look identical.
 * Lives outside Button.tsx so that file only exports components (fast refresh).
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'group relative inline-flex select-none items-center justify-center font-medium',
    'transition-[transform,filter,background-color,border-color,box-shadow] duration-300 ease-spring',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}
