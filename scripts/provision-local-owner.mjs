import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ownerId = process.env.OWNER_SUPABASE_USER_ID;
if (
  !ownerId ||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    ownerId,
  )
)
  throw new Error(
    "Set OWNER_SUPABASE_USER_ID to the owner user UUID before provisioning.",
  );
await mkdir(".artifacts", { recursive: true });
const file = path.resolve(".artifacts/provision-local-owner.sql");
await writeFile(
  file,
  `INSERT INTO workspaces (id, owner_id, created_at) VALUES ('${randomUUID()}', '${ownerId}', ${Date.now()}) ON CONFLICT (owner_id) DO NOTHING;\n`,
);
// Fixed --local and config; this command cannot provision a remote database.
execFileSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "apps/api/wrangler.local.jsonc",
    "--file",
    file,
  ],
  { stdio: "inherit" },
);
console.info(
  "Local owner workspace provisioned (existing workspace preserved).",
);
