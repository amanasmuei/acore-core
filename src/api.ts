import { getCurrentScopeOr, type Scope } from "@aman_asmuei/aman-core";
import type { Identity } from "./identity.js";
import { getSection, setSection, setBulletField } from "./identity.js";
import { getStorageForScope } from "./storage.js";
import { defaultIdentityTemplate } from "./default-template.js";

/**
 * The default scope used when no explicit scope is passed and no withScope()
 * block is active. This matches the legacy behavior of "one identity per
 * machine" while letting multi-tenant consumers (aman-tg, agent personas)
 * pass their own scope explicitly.
 */
const DEFAULT_FALLBACK_SCOPE: Scope = "dev:default";

function resolveScope(explicit: Scope | undefined): Scope {
  return explicit ?? getCurrentScopeOr(DEFAULT_FALLBACK_SCOPE);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read the identity for a scope. If no scope is passed, the active
 * `withScope()` value is used (or `dev:default` if no scope is active).
 *
 * Returns `null` if no identity has been written for this scope yet.
 * Use `getOrCreateIdentity()` if you want a default-template fallback.
 */
export async function getIdentity(scope?: Scope): Promise<Identity | null> {
  const s = resolveScope(scope);
  return getStorageForScope(s).get(s);
}

/**
 * Read the identity for a scope, creating it from the default template if
 * none exists. Always returns an Identity (never null).
 */
export async function getOrCreateIdentity(scope?: Scope): Promise<Identity> {
  const s = resolveScope(scope);
  const storage = getStorageForScope(s);
  const existing = await storage.get(s);
  if (existing) return existing;
  const fresh = defaultIdentityTemplate(s);
  await storage.put(s, fresh);
  return fresh;
}

/**
 * Read a single section's body. Returns `null` if the section is missing or
 * no identity exists for the scope.
 */
export async function getSectionContent(
  sectionName: string,
  scope?: Scope,
): Promise<string | null> {
  const identity = await getIdentity(scope);
  if (!identity) return null;
  return getSection(identity, sectionName);
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Replace the entire identity for a scope.
 */
export async function putIdentity(
  identity: Identity,
  scope?: Scope,
): Promise<void> {
  const s = resolveScope(scope);
  await getStorageForScope(s).put(s, identity);
}

/**
 * Update the body of a markdown section by name. Creates the identity from
 * the default template if it doesn't exist. Appends a new section if the
 * named section is missing from the document.
 */
export async function updateSection(
  sectionName: string,
  content: string,
  scope?: Scope,
): Promise<void> {
  const s = resolveScope(scope);
  const storage = getStorageForScope(s);
  const identity = await getOrCreateIdentity(s);
  const updated = setSection(identity, sectionName, content);
  await storage.put(s, updated);
}

/**
 * The shape of a dynamics update. All fields are optional — only the ones
 * you pass are written. Mirrors `aman-mcp`'s `identity_update_dynamics` so
 * the existing MCP wrapper can switch to acore-core with no behavior change.
 */
export interface DynamicsUpdate {
  /** A short read of the user's current emotional/energy state. */
  currentRead?: string;
  /** Baseline energy override (e.g. high-drive / steady / reflective). */
  energy?: string;
  /** Active context mode (e.g. Default / Focused Work / Creative / Personal). */
  activeMode?: string;
  /** Trust score from the dynamic user model (0-1 as percentage string). */
  trust?: string;
  /** Total session count from the user model. */
  sessions?: number;
  /** Sentiment trend across recent sessions. */
  sentimentTrend?: string;
}

/**
 * Update the dynamics fields (current read, baseline energy, active mode)
 * surgically — without rewriting the whole `## Dynamics` section. Each field
 * is updated only if its bullet is found in the document.
 *
 * Creates the identity from the default template if missing.
 */
export async function updateDynamics(
  update: DynamicsUpdate,
  scope?: Scope,
): Promise<void> {
  const s = resolveScope(scope);
  const storage = getStorageForScope(s);
  let identity = await getOrCreateIdentity(s);

  if (update.currentRead !== undefined) {
    identity = setBulletField(identity, "Current read", update.currentRead);
  }
  if (update.energy !== undefined) {
    identity = setBulletField(identity, "Baseline energy", update.energy);
  }
  if (update.activeMode !== undefined) {
    identity = setBulletField(identity, "Active mode", update.activeMode);
  }
  if (update.trust !== undefined) {
    identity = setBulletField(identity, "Trust", update.trust);
  }
  if (update.sessions !== undefined) {
    identity = setBulletField(identity, "Sessions", String(update.sessions));
  }
  if (update.sentimentTrend !== undefined) {
    identity = setBulletField(identity, "Sentiment trend", update.sentimentTrend);
  }

  await storage.put(s, identity);
}

/**
 * Delete the identity for a scope. Returns silently if no identity exists.
 */
export async function deleteIdentity(scope?: Scope): Promise<void> {
  const s = resolveScope(scope);
  await getStorageForScope(s).delete(s);
}

/**
 * List all scopes that have an identity stored across both backends.
 * Useful for admin tools and migration scripts.
 */
export async function listIdentityScopes(): Promise<{
  markdown: Scope[];
  database: Scope[];
}> {
  const { getMarkdownStorage, getDatabaseStorage } = await import("./storage.js");
  return {
    markdown: await getMarkdownStorage().listScopes(),
    database: await getDatabaseStorage().listScopes(),
  };
}
