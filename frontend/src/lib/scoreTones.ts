/** Semantic score bands shared by progress bars, gauges and badges. */
export type ScoreTone = 'success' | 'warn' | 'error';

/**
 * Maps a 0-1 score to a semantic band using one shared rule set, so bars,
 * gauges and badges never disagree with each other.
 */
export function scoreTone(value: number, threshold = 0.5): ScoreTone {
  if (value >= Math.max(threshold + 0.2, 0.7)) return 'success';
  if (value >= threshold) return 'warn';
  return 'error';
}
