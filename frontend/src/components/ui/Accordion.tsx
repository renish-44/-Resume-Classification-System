import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fadeUp } from '@/lib/motion';

export interface AccordionItemData {
  id: string;
  question: ReactNode;
  answer: ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  /** Allow several panels open at once. */
  allowMultiple?: boolean;
  /** Id of the panel open on first render. */
  defaultOpenId?: string | null;
  className?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultOpenId = null,
  className,
}: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultOpenId ? [defaultOpenId] : []);

  const toggle = (id: string) => {
    setOpen((current) => {
      const isOpen = current.includes(id);
      if (allowMultiple) {
        return isOpen ? current.filter((item) => item !== id) : [...current, id];
      }
      return isOpen ? [] : [id];
    });
  };

  return (
    <div
      className={cn(
        'divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/50',
        className,
      )}
    >
      {items.map((item) => {
        const isOpen = open.includes(item.id);

        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                id={`accordion-trigger-${item.id}`}
                aria-expanded={isOpen}
                aria-controls={`accordion-panel-${item.id}`}
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-elevated/50"
              >
                <span className="text-base font-medium sm:text-[17px]">{item.question}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform duration-300',
                    isOpen && 'rotate-45 border-brand-400/50 bg-brand-500/10 text-brand-300',
                  )}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="panel"
                  id={`accordion-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`accordion-trigger-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <motion.div
                    variants={fadeUp}
                    className="px-5 pb-6 pr-12 text-sm leading-relaxed text-muted sm:text-base"
                  >
                    {item.answer}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
