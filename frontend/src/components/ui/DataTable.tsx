import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** Value used for sorting when the rendered node is not text. */
  sortValue?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Screen-reader caption describing the table. */
  caption: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Text searched by the filter box. */
  searchText?: (row: T) => string;
  initialSort?: { key: string; direction: SortDirection };
  /** Highlights the selected/best row. */
  rowHighlight?: (row: T) => boolean;
  emptyMessage?: string;
  /** Sticky table header while scrolling. */
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}

/**
 * Generic data table: click-to-sort columns (nulls always last), optional
 * search box, optional row highlight. Fully keyboard operable.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  searchable = false,
  searchPlaceholder = 'Search\u2026',
  searchText,
  initialSort,
  rowHighlight,
  emptyMessage = 'No rows match the current filters.',
  stickyHeader = true,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(
    initialSort ?? null,
  );

  const filtered = useMemo(() => {
    if (!searchable || query.trim() === '') return rows;
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => (searchText ? searchText(row) : '').toLowerCase().includes(needle));
  }, [rows, query, searchable, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return filtered;

    const direction = sort.direction === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const rawA = column.sortValue ? column.sortValue(a) : null;
      const rawB = column.sortValue ? column.sortValue(b) : null;

      // Placeholders / missing values always sink to the bottom.
      if (rawA === null && rawB === null) return 0;
      if (rawA === null) return 1;
      if (rawB === null) return -1;

      if (typeof rawA === 'number' && typeof rawB === 'number') {
        return (rawA - rawB) * direction;
      }
      return String(rawA).localeCompare(String(rawB)) * direction;
    });
  }, [filtered, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'desc' };
      return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-line bg-surface/70 pl-10 pr-3 text-sm text-content placeholder:text-faint focus:border-brand-400/70 focus:outline-none"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead className={cn('bg-surface/80', stickyHeader && 'sticky top-0 z-10 backdrop-blur')}>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const SortIcon = !active
                  ? ChevronsUpDown
                  : sort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                    className={cn(
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.headClassName,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-content',
                          active && 'text-brand-300',
                        )}
                      >
                        {column.header}
                        <SortIcon aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const highlighted = rowHighlight?.(row) ?? false;

                return (
                  <tr
                    key={getRowId(row)}
                    className={cn(
                      highlighted && 'bg-brand-500/[0.07]',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          column.className,
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <p className="text-xs text-faint">
          Showing {sorted.length} of {rows.length} row{rows.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
