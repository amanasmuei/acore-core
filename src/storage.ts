import * as path from "node:path";
import * as os from "node:os";
import {
  type Scope,
  type Storage,
  MarkdownFileStorage,
  DatabaseStorage,
  parseScope,
} from "@aman_asmuei/aman-core";
import type { Identity } from "./identity.js";

/**
 * Codec between Identity records and the string form that storage backends
 * persist. Identity is a markdown blob, so the codec is the identity function.
 */
const identityCodec = {
  serialize: (i: Identity): string => i.content,
  deserialize: (raw: string): Identity => ({ content: raw }),
};

const ACORE_FILENAME = "core.md";
const ACORE_DB_TABLE = "acore_identities";

/**
 * Default root for human-editable acore files. Defaults to `~/.acore` so the
 * legacy `~/.acore/core.md` location stays nearby. Override with `$ACORE_HOME`.
 *
 * The new layout is `~/.acore/{scope.replace(':','/')}/core.md` — for example:
 *   scope `dev:default`           → ~/.acore/dev/default/core.md
 *   scope `dev:plugin`            → ~/.acore/dev/plugin/core.md
 *
 * `tg:*` and `agent:*` scopes do NOT use the markdown layout — they go to
 * DatabaseStorage instead, via `getStorageForScope()`.
 */
export function getAcoreHome(): string {
  if (process.env.ACORE_HOME) return process.env.ACORE_HOME;
  return path.join(os.homedir(), ".acore");
}

let _markdownStorage: MarkdownFileStorage<Identity> | null = null;
let _databaseStorage: DatabaseStorage<Identity> | null = null;

/**
 * Default read-only scope inheritance policy for acore:
 *
 *   dev:plugin   → no fallback (root of the chain)
 *   dev:copilot  → falls back to dev:plugin
 *   dev:agent    → falls back to dev:plugin
 *   dev:<other>  → falls back to dev:plugin
 *   tg:* / agent:* → no fallback (different storage backend anyway)
 *
 * Rationale: aman-plugin is the flagship surface — it's the one most users
 * set up first, and a new surface joining the ecosystem (Copilot, aman-agent,
 * Cursor, ...) should automatically see the same identity without re-entry.
 * Users who deliberately want an independent identity for a specific surface
 * can opt out by writing to that scope directly; writes never cascade to the
 * fallback target, so scope isolation is preserved for mutations.
 *
 * Override: pass a different `fallbackChain` to `MarkdownFileStorage` directly
 * if the caller needs non-default inheritance (e.g., tests, custom surfaces).
 */
function defaultDevFallbackChain(requested: Scope): Scope[] {
  if (requested.startsWith("dev:") && requested !== "dev:plugin") {
    return ["dev:plugin"];
  }
  return [];
}

/**
 * Get the markdown-backed storage for dev-side scopes. Cached.
 */
export function getMarkdownStorage(): MarkdownFileStorage<Identity> {
  if (!_markdownStorage) {
    const root = getAcoreHome();
    _markdownStorage = new MarkdownFileStorage<Identity>({
      root,
      filename: ACORE_FILENAME,
      fallbackChain: defaultDevFallbackChain,
      legacyPath: path.join(root, ACORE_FILENAME),
      ...identityCodec,
    });
  }
  return _markdownStorage;
}

/**
 * Get the SQLite-backed storage for server/multi-tenant scopes. Cached.
 * Uses the shared engine DB at `~/.aman/engine.db` (or `$AMAN_ENGINE_DB`).
 */
export function getDatabaseStorage(): DatabaseStorage<Identity> {
  if (!_databaseStorage) {
    _databaseStorage = new DatabaseStorage<Identity>({
      tableName: ACORE_DB_TABLE,
      ...identityCodec,
    });
  }
  return _databaseStorage;
}

/**
 * Pick the right storage backend for a given scope.
 *
 *   dev:*     → MarkdownFileStorage (human-editable, git-versionable)
 *   tg:*      → DatabaseStorage (server-side, multi-tenant high-volume)
 *   agent:*   → DatabaseStorage (per-agent personas)
 *   <other>   → DatabaseStorage (default for any unknown frontend prefix)
 *
 * This is the convention-over-configuration routing. The 99% case works
 * automatically. If you need to override, pass storage explicitly to the
 * lower-level Storage<Identity> instance methods.
 */
export function getStorageForScope(scope: string): Storage<Identity> {
  const parsed = parseScope(scope);
  if (parsed.frontend === "dev") {
    return getMarkdownStorage();
  }
  return getDatabaseStorage();
}

/**
 * Reset cached storage instances. Intended for tests that need to point at
 * a fresh temp directory or DB. Closes the underlying SQLite connection if
 * one exists.
 */
export function _resetStorageCache(): void {
  if (_databaseStorage) {
    _databaseStorage.close();
  }
  _markdownStorage = null;
  _databaseStorage = null;
}
