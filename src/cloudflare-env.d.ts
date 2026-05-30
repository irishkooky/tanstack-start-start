// Cloudflare Workers の `env`（バインディング・シークレット）の最小型定義。
// secret は wrangler.jsonc に載らないので手で宣言する。
declare module "cloudflare:workers" {
  export const env: {
    ANTHROPIC_API_KEY?: string;
  };
}
