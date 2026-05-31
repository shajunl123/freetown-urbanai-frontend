/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_WEBHOOK_URL?: string;
  readonly VITE_UPLOAD_FORM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
