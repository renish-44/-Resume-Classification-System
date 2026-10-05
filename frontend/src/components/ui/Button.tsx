import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { buttonStyles } from './buttonStyles';
import type { ButtonStyleOptions } from './buttonStyles';

export interface ButtonProps
  extends ButtonStyleOptions, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    fullWidth,
    className,
    loading = false,
    iconLeft,
    iconRight,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  );
});

export interface LinkButtonProps extends ButtonStyleOptions {
  to: string;
  children: ReactNode;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  'aria-label'?: string;
  onClick?: () => void;
}

export function LinkButton({
  to,
  children,
  iconLeft,
  iconRight,
  variant,
  size,
  fullWidth,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link to={to} className={buttonStyles({ variant, size, fullWidth, className })} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}

export interface AnchorButtonProps extends ButtonStyleOptions {
  href: string;
  children: ReactNode;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  'aria-label'?: string;
  target?: '_blank' | '_self';
  rel?: string;
}

export function AnchorButton({
  href,
  children,
  iconLeft,
  iconRight,
  variant,
  size,
  fullWidth,
  className,
  target = '_blank',
  rel = 'noreferrer noopener',
  ...rest
}: AnchorButtonProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </a>
  );
}
