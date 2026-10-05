import { FlaskConical } from 'lucide-react';
import type { HealthState } from '@/lib/api';
import { usingMockBackend } from '@/lib/api';
import { Alert } from '@/components/ui/Alert';
import { BackendStatusBanner } from '@/components/layout/BackendStatusChip';

/**
 * Shown whenever the app has no backend configured. The demo is fully usable
 * but every prediction is simulated, and the banner says so loudly.
 */
export function MockModeBanner({ className = '' }: { className?: string }) {
  if (!usingMockBackend) return null;

  return (
    <Alert tone="warn" live className={className} title="Demo mode — simulated output">
      <span className="flex flex-col gap-1">
        <span>
          No <code className="font-mono text-[13px] text-amber2">VITE_API_URL</code> is configured,
          so predictions below are deterministic mock responses, not real model output.
        </span>
        <span className="text-muted">
          Set the variable in <code className="font-mono text-[13px]">frontend/.env.local</code> to
          your FastAPI base URL and restart <code className="font-mono text-[13px]">npm run dev</code>.
        </span>
      </span>
    </Alert>
  );
}

/** Small chip variant for the demo result panel. */
export function MockModeChip() {
  if (!usingMockBackend) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber2/35 bg-amber2/10 px-2.5 py-1 text-[11px] font-semibold text-amber2">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Simulated output
    </span>
  );
}

/**
 * Real-mode counterpart of the mock banner: reports what `GET /health` said.
 * Keeps the "model not loaded" case explicit instead of failing at predict time.
 */
export function BackendStateBanner({
  health,
  onRefresh,
  className = '',
}: {
  health: HealthState;
  onRefresh: () => void;
  className?: string;
}) {
  if (usingMockBackend) return null;
  if (health.kind === 'connected') return null;
  if (health.kind === 'checking') return null;

  return <BackendStatusBanner health={health} onRefresh={onRefresh} className={className} />;
}