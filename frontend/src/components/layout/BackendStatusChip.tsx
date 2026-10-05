import { Activity, CircleAlert, CircleCheck, FlaskConical, Loader2, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HealthState } from '@/lib/api';
import { cn } from '@/lib/cn';

export interface BackendStatusChipProps {
  health: HealthState;
  onRefresh: () => void;
  className?: string;
}

interface ChipConfig {
  label: string;
  title: string;
  icon: LucideIcon;
  className: string;
}

/** One visual state per health outcome — no invented status is ever shown. */
function chipFor(health: HealthState): ChipConfig {
  switch (health.kind) {
    case 'mock':
      return {
        label: 'Demo mode',
        title: 'VITE_API_URL is empty — predictions are simulated, not from the model.',
        icon: FlaskConical,
        className: 'border-amber2/35 bg-amber2/10 text-amber2',
      };
    case 'checking':
      return {
        label: 'Checking API',
        title: 'Calling GET /health…',
        icon: Loader2,
        className: 'border-line bg-elevated/70 text-muted',
      };
    case 'connected':
      return {
        label: 'API connected',
        title: health.modelName
          ? `Backend reachable · model: ${health.modelName}`
          : 'Backend reachable · model loaded',
        icon: CircleCheck,
        className: 'border-mint/35 bg-mint/10 text-mint',
      };
    case 'model-missing':
      return {
        label: 'No model loaded',
        title: `Backend is running but no model artifact is loaded${
          health.version ? ` (API v${health.version})` : ''
        }. Add models/model.joblib and restart.`,
        icon: TriangleAlert,
        className: 'border-amber2/35 bg-amber2/10 text-amber2',
      };
    case 'unreachable':
    default:
      return {
        label: 'API unreachable',
        title: `${health.detail} Click to retry.`,
        icon: CircleAlert,
        className: 'border-rose2/40 bg-rose2/10 text-rose2',
      };
  }
}

/**
 * Small live status chip for the navbar: connected / model-missing /
 * unreachable / demo mode. Clicking re-probes `GET /health`.
 */
export function BackendStatusChip({ health, onRefresh, className }: BackendStatusChipProps) {
  const config = chipFor(health);
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onRefresh}
      title={config.title}
      aria-label={`${config.label}. ${config.title}`}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-opacity hover:opacity-80',
        config.className,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('h-3.5 w-3.5', health.kind === 'checking' && 'animate-spin')}
      />
      <span className="hidden sm:inline">{config.label}</span>
      <span className="sr-only sm:hidden">{config.label}</span>
    </button>
  );
}

/** Longer variant used above the demo panel. */
export function BackendStatusBanner({ health, onRefresh }: BackendStatusChipProps) {
  const config = chipFor(health);
  const Icon = config.icon;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3', config.className)}>
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', health.kind === 'checking' && 'animate-spin')} />
        <span className="text-sm font-medium">{config.title}</span>
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-75"
      >
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Re-check
      </button>
    </div>
  );
}