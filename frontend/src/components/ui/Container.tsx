import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'narrow' | 'wide';
}

const SIZES: Record<NonNullable<ContainerProps['size']>, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-content',
  wide: 'max-w-[1400px]',
};

/** 12-column friendly page container capped at 1200px. */
export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { size = 'default', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('mx-auto w-full px-5 sm:px-6 lg:px-8', SIZES[size], className)}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  /** Adds a subtle top divider line. */
  divided?: boolean;
  children: ReactNode;
}

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    id,
    eyebrow,
    title,
    description,
    align = 'center',
    divided = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        'relative scroll-mt-28 py-16 sm:py-20 lg:py-24',
        divided && 'border-t border-line',
        className,
      )}
      {...rest}
    >
      {(eyebrow || title || description) && (
        <Container className={cn('mb-10 sm:mb-14', align === 'center' && 'text-center')}>
          {eyebrow && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">{title}</h2>
          )}
          {description && (
            <p
              className={cn(
                'mt-4 text-base leading-relaxed text-muted sm:text-lg',
                align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl',
              )}
            >
              {description}
            </p>
          )}
        </Container>
      )}
      {children}
    </section>
  );
});
