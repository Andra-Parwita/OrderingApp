// The Worker project does not load vite/client; declare the one flag it reads.
interface ImportMeta {
  readonly env: { readonly DEV: boolean };
}
