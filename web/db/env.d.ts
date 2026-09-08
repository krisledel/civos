/// <reference types="@cloudflare/workers-types" />
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ATTACHMENTS: R2Bucket;
    CIVOS_SIGNING_KEY: string;
  }
}
