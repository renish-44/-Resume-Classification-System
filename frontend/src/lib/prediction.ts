import type { PredictResponse } from './api';
import { usingMockBackend } from './api';

export interface PredictionPayload {
  predicted_category: string;
  confidence: number;
  top_predictions: { category: string; probability: number }[];
  model: string;
  extracted_chars: number;
  low_confidence?: boolean;
  mode: 'simulated' | 'live';
  predicted_at: string;
}

/**
 * Trust the server's `low_confidence` flag when present; otherwise compare the
 * confidence against the configured threshold.
 */
export function isLowConfidence(result: PredictResponse, threshold: number): boolean {
  return result.low_confidence ?? result.confidence < threshold;
}

/**
 * Builds the JSON the demo can copy or download.
 * The exported shape is identical to the API contract plus provenance fields,
 * so the file is self-explanatory when a judge opens it.
 */
export function buildResultPayload(prediction: {
  result: PredictResponse;
  at: string;
}): PredictionPayload {
  return {
    ...prediction.result,
    mode: usingMockBackend ? 'simulated' : 'live',
    predicted_at: prediction.at,
  };
}
