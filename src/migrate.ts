import * as fs from "node:fs";
import * as path from "node:path";
import { ensureDir } from "@aman_asmuei/aman-core";
import { getAcoreHome } from "./storage.js";

export interface AcoreMigrationReport {
  legacyPath: string;
  newPath: string;
  status: "no-op" | "copied" | "error";
  message: string;
}

/**
 * One-time migration of the legacy `~/.acore/core.md` (single-tenant layout)
 * to the new multi-tenant layout at `~/.acore/dev/default/core.md`.
 *
 * The legacy file is COPIED, never moved or deleted — that's intentional, so
 * a user who runs the migration and then has a problem can fall back to the
 * old location. The acore CLI can offer to delete the legacy file once the
 * migration is verified.
 *
 * Idempotent: if the new path already exists, this is a no-op (regardless of
 * whether the legacy path also exists). Safe to call multiple times.
 *
 * After this migration, `getIdentity('dev:default')` reads from the new path
 * via MarkdownFileStorage with no further action needed.
 */
export function migrateLegacyAcoreFile(): AcoreMigrationReport {
  const root = getAcoreHome();
  const legacyPath = path.join(root, "core.md");
  const newPath = path.join(root, "dev", "default", "core.md");

  if (!fs.existsSync(legacyPath)) {
    return {
      legacyPath,
      newPath,
      status: "no-op",
      message: `No legacy file at ${legacyPath} — nothing to migrate.`,
    };
  }

  if (fs.existsSync(newPath)) {
    return {
      legacyPath,
      newPath,
      status: "no-op",
      message: `New file already exists at ${newPath}; legacy file left in place.`,
    };
  }

  try {
    ensureDir(path.dirname(newPath));
    fs.copyFileSync(legacyPath, newPath);
    return {
      legacyPath,
      newPath,
      status: "copied",
      message: `Copied ${legacyPath} → ${newPath}. Legacy file preserved; remove it manually if migration is verified.`,
    };
  } catch (err) {
    return {
      legacyPath,
      newPath,
      status: "error",
      message: `Failed to copy: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
