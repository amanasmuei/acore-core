// ── Identity record + section helpers ────────────────────────────────────────
export {
  type Identity,
  getSection,
  setSection,
  setBulletField,
  getBulletField,
  listSections,
} from "./identity.js";

// ── Default template ─────────────────────────────────────────────────────────
export { defaultIdentityTemplate } from "./default-template.js";

// ── Storage routing ──────────────────────────────────────────────────────────
export {
  getAcoreHome,
  getMarkdownStorage,
  getDatabaseStorage,
  getStorageForScope,
  _resetStorageCache,
} from "./storage.js";

// ── Public API ───────────────────────────────────────────────────────────────
export {
  getIdentity,
  getOrCreateIdentity,
  getSectionContent,
  putIdentity,
  updateSection,
  updateDynamics,
  deleteIdentity,
  listIdentityScopes,
  type DynamicsUpdate,
} from "./api.js";

// ── Migration ────────────────────────────────────────────────────────────────
export {
  type AcoreMigrationReport,
  migrateLegacyAcoreFile,
} from "./migrate.js";
