/**
 * An Identity record. The content is the full markdown of the identity file
 * (the same shape that ~/.acore/core.md uses today). Section operations are
 * layered on top via helper functions in this module — the storage layer
 * doesn't know or care about markdown structure.
 *
 * Markdown blob over typed schema is intentional: it stays backward-compatible
 * with the existing acore CLI templates, lets users hand-edit core.md in vim,
 * and lets both storage backends (MarkdownFileStorage, DatabaseStorage) treat
 * the value as an opaque string.
 */
export interface Identity {
  content: string;
}

// Match start-of-string OR a newline immediately before `## ` — this lets us
// avoid the `m` flag, which would make `$` match end-of-line and collapse
// section bodies to a single line.
const SECTION_START_PREFIX = "(?:^|\\n)";
const SECTION_END_LOOKAHEAD = "(?=\\n## |\\n---|$)";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Read the body of a markdown section by heading name.
 *
 *   getSection({ content: "## Personality\nWarm and direct.\n## Other\n..." }, "Personality")
 *   → "Warm and direct."
 *
 * Returns the trimmed body of the section, or `null` if no section with that
 * heading exists. The match terminates at the next `## ` heading, a `---`
 * separator, or end of file.
 */
export function getSection(identity: Identity, sectionName: string): string | null {
  const escaped = escapeRegExp(sectionName);
  const pattern = new RegExp(
    `${SECTION_START_PREFIX}## ${escaped}\\s*\\n([\\s\\S]*?)${SECTION_END_LOOKAHEAD}`,
  );
  const match = identity.content.match(pattern);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Replace the body of a markdown section. If the section exists, only its
 * body is replaced (the heading and any trailing structural markers stay put).
 * If the section does NOT exist, it is appended at the end of the document.
 *
 * Returns a new Identity (does not mutate the input).
 */
export function setSection(
  identity: Identity,
  sectionName: string,
  newContent: string,
): Identity {
  const escaped = escapeRegExp(sectionName);
  const pattern = new RegExp(
    `(${SECTION_START_PREFIX}## ${escaped}\\s*\\n)[\\s\\S]*?${SECTION_END_LOOKAHEAD}`,
  );
  const trimmedNew = newContent.trim();

  if (pattern.test(identity.content)) {
    return {
      content: identity.content.replace(pattern, `$1${trimmedNew}\n`),
    };
  }

  // Section doesn't exist — append at end.
  const sep = identity.content.endsWith("\n") ? "" : "\n";
  return {
    content: `${identity.content}${sep}\n## ${sectionName}\n${trimmedNew}\n`,
  };
}

/**
 * Update a single `- Field: value` bullet line in the markdown. Used by
 * `updateDynamics()` to surgically change individual fields without
 * rewriting whole sections.
 *
 * If the field is not present anywhere in the document, the identity is
 * returned unchanged. Callers that need create-on-missing should check the
 * return value or use `setSection()`.
 */
export function setBulletField(
  identity: Identity,
  fieldName: string,
  value: string,
): Identity {
  const escaped = escapeRegExp(fieldName);
  const pattern = new RegExp(`^(- ${escaped}:\\s*).*$`, "m");
  if (!pattern.test(identity.content)) {
    return identity;
  }
  return {
    content: identity.content.replace(pattern, `$1${value}`),
  };
}

/**
 * Get the value of a `- Field: value` bullet line. Returns null if the
 * field is not present.
 */
export function getBulletField(
  identity: Identity,
  fieldName: string,
): string | null {
  const escaped = escapeRegExp(fieldName);
  const pattern = new RegExp(`^- ${escaped}:\\s*(.*)$`, "m");
  const match = identity.content.match(pattern);
  if (!match) return null;
  return match[1].trim();
}

/**
 * List all section names (## headings) found in the identity, in document order.
 */
export function listSections(identity: Identity): string[] {
  const matches = identity.content.matchAll(/^## (.+?)\s*$/gm);
  return Array.from(matches, (m) => m[1].trim());
}
