/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The preview document's maximum length (fallback 2000). */
  readonly VITE_PREVIEW_MAX_LENGTH?: string;
  /** Each text input's maximum length (fallback 500). */
  readonly VITE_TEXT_INPUT_MAX_LENGTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
