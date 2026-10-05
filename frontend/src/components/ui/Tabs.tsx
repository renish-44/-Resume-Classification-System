import { motion } from 'framer-motion';
import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Optional trailing element, e.g. a character counter. */
  meta?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  variant?: 'pill' | 'underline';
  className?: string;
  idPrefix?: string;
}

/**
 * Accessible tablist: arrow keys, Home/End, roving tabindex.
 * Consumers render the matching panel with
 * `<div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`}>`.
 */
export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  variant = 'pill',
  className,
  idPrefix = 'tabs',
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    if (enabled.length === 0) return;

    const currentIndex = enabled.findIndex((item) => item.id === value);
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % enabled.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextItem = enabled[nextIndex];
    onChange(nextItem.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${idPrefix}-tab-${nextItem.id}`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-wrap gap-1.5',
        variant === 'pill' && 'rounded-2xl border border-line bg-surface/60 p-1.5',
        variant === 'underline' && 'gap-6 border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;

        return (
          <button
            key={item.id}
            id={`${idPrefix}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium',
              'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
              variant === 'pill' && 'px-4 py-2.5',
              variant === 'underline' && '-mb-px px-1 py-3',
              selected
                ? variant === 'pill'
                  ? 'text-white'
                  : 'text-content'
                : 'text-muted hover:text-content',
            )}
          >
            {selected && variant === 'pill' && (
              <motion.span
                layoutId={`${idPrefix}-active`}
                className="absolute inset-0 rounded-xl bg-gradient-brand shadow-glow"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            {selected && variant === 'underline' && (
              <motion.span
                layoutId={`${idPrefix}-underline`}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-brand"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
              {item.meta}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  activeId: string;
  idPrefix?: string;
  children: ReactNode;
  className?: string;
}

/** Panel wrapper that pairs with <Tabs>. */
export function TabPanel({ id, activeId, idPrefix = 'tabs', children, className }: TabPanelProps) {
  if (id !== activeId) return null;

  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}
