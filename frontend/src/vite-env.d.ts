/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LOW_CONFIDENCE_THRESHOLD?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_MODEL_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
