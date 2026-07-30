import { existsSync } from "node:fs";

// Locally, DATABASE_URL/AUTH_SECRET come from .env.test (gitignored, same
// pattern as .env/.env.production). In CI these are already set directly
// by the workflow's `env:` block, so there's no file to load.
if (existsSync(".env.test")) {
  process.loadEnvFile(".env.test");
}
