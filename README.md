<div align="center">

# @aman_asmuei/acore-core

**The identity layer for the aman ecosystem.**

Multi-tenant `Identity` records — markdown blobs with surgical section
helpers, auto-routing storage, and a stable library API. The same
identity engine that powers Claude Code's persistent memory, the CLI
agent, and Telegram super-app users.

[![npm version](https://img.shields.io/npm/v/@aman_asmuei/acore-core?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/@aman_asmuei/acore-core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%E2%89%A518-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-57_passing-brightgreen?style=for-the-badge)](#quality-signals)
[![Part of aman](https://img.shields.io/badge/part_of-aman_ecosystem-ff6b35?style=for-the-badge)](https://github.com/amanasmuei/aman)

[Install](#install) &middot;
[Quick start](#quick-start) &middot;
[Why markdown-blob](#why-markdown-blob) &middot;
[Concepts](#concepts) &middot;
[API reference](#api-reference) &middot;
[The aman ecosystem](#the-aman-ecosystem)

</div>

---

## What it is

`acore-core` is the identity layer of the aman engine. It manages "what
the AI knows about you" — your name, role, personality, current emotional
read, dynamic context — as a structured but flexible markdown document,
with a programmable library API.

**One identity per scope.** The same package serves your local dev identity
(`dev:default`), your Claude Code session identity (`dev:plugin`), per-agent
personalities (`agent:jiran`), and per-user identities for thousands of
Telegram users (`tg:12345`) — all from one library, with complete state
isolation between scopes.

This package extracts a programmable library API out of the existing
`@aman_asmuei/acore` CLI. The CLI keeps working unchanged. New consumers
(`aman-mcp`, `aman-agent`, `aman-tg` backend, future tools) call this
library directly instead of reading `~/.acore/core.md` via filesystem and regex.

---

## Why markdown-blob

`Identity` is intentionally **a markdown string**, not a typed struct:

```typescript
interface Identity {
  content: string;  // the full markdown of the identity file
}
```

Three reasons:

1. **Hand-editable.** A user can `vim ~/.acore/dev/default/core.md` and
   the AI immediately knows the new thing. No SQL editor, no admin UI.
2. **Git-versionable.** `cd ~/.acore && git init` and you have a full
   personality history. No other AI personality system gives you this.
3. **Backward compatible.** The existing `acore` CLI templates already
   use this exact markdown shape. Zero-migration adoption.

The schema-flexibility tradeoff is deliberate: there's no type safety on
individual sections, but the section helpers in this package give you
ergonomic access patterns without locking the schema. You can add a new
`## Whatever` section to the markdown, and `getSection(identity, "Whatever")`
just works.

---

## Install

```bash
npm install @aman_asmuei/acore-core
```

`acore-core` depends on `@aman_asmuei/aman-core` for the scope substrate
and `Storage<T>` interface. `better-sqlite3` is required at runtime if you
use the `DatabaseStorage` backend (i.e. for non-`dev:*` scopes).

---

## Quick start

```typescript
import {
  getIdentity,
  getOrCreateIdentity,
  updateSection,
  updateDynamics,
  getSectionContent,
  type Identity,
} from "@aman_asmuei/acore-core";

// Dev side: backed by ~/.acore/dev/default/core.md (markdown file)
await updateSection("Personality", "Warm and direct", "dev:default");

const personality = await getSectionContent("Personality", "dev:default");
// → "Warm and direct"

// Telegram user 12345: backed by ~/.aman/engine.db acore_identities table
await updateSection(
  "Personality",
  "Manglish, friendly, helpful",
  "tg:12345",
);

// Update emotional state surgically (without rewriting whole sections)
await updateDynamics(
  {
    currentRead: "late-night, focused on shipping",
    energy: "high-drive",
    activeMode: "Focused Work",
  },
  "dev:default",
);

// Bootstrap a new identity from the default template
const identity = await getOrCreateIdentity("agent:jiran");
// Returns Jiran's identity record, creating it from a default markdown
// template if it doesn't exist
```

That's the whole API for 90% of use cases. **Same call, different scope,
different storage backend, complete state isolation.** No parameter
threading, no scope leakage.

---

## Concepts

### Identity record

`Identity` is a markdown blob:

```typescript
interface Identity {
  content: string;
}
```

The content follows the `acore` CLI's existing template shape:

```markdown
# Aman

> Your AI companion (scope: dev:default)

## User
- Name: Aman
- Role: Founder, builder of the aman ecosystem

## Personality
Warm, direct, technically curious. KISS-first.

## Session
- Last updated: 2026-04-07
- Resume: shipping engine v1 alpha
- Active topics: aman-core, acore-core, multi-tenant scope

## Dynamics
- Current read: focused, late-night
- Baseline energy: high-drive
- Active mode: Focused Work
```

The structure is convention, not a hard schema. You can add `## Goals`,
`## Appearance`, `## Relationships`, or anything else — the helpers below
work on whatever section names you use.

### Section helpers

Pure functions over `Identity` records:

```typescript
import {
  getSection,
  setSection,
  setBulletField,
  getBulletField,
  listSections,
} from "@aman_asmuei/acore-core";

const identity: Identity = { content: existingMarkdown };

// Read a section's body
const personality = getSection(identity, "Personality");
// → "Warm, direct, technically curious. KISS-first."

// Replace a section's body (returns new Identity, doesn't mutate)
const updated = setSection(identity, "Personality", "Direct and warm.");

// Surgical bullet update for `- Field: value` lines
const newIdentity = setBulletField(identity, "Current read", "calm, evening");

// Read a single bullet
const role = getBulletField(identity, "Role"); // "Founder, builder..."

// List all top-level sections
const sections = listSections(identity);
// → ["User", "Personality", "Session", "Dynamics"]
```

The section parser is a simple line-based walker — no `m`-flag regex
gotchas, no greediness surprises. It correctly handles section bodies that
span multiple lines, terminates at the next `## ` heading or `---`
separator or end-of-file, and ignores `### ` and lower headings.

### Auto-routing storage — convention over configuration

`acore-core` picks the right storage backend based on the scope's frontend
prefix. You don't pass storage explicitly:

| Scope prefix | Backend                | Where it persists                                  |
|-------------|------------------------|----------------------------------------------------|
| `dev:*`     | `MarkdownFileStorage`  | `~/.acore/{scope.replace(':','/')}/core.md`        |
| `tg:*`      | `DatabaseStorage`      | `~/.aman/engine.db` table `acore_identities`       |
| `agent:*`   | `DatabaseStorage`      | same                                                |
| (other)     | `DatabaseStorage`      | same                                                |

**Why this split?** Dev users want to hand-edit their identity in vim and
commit it to git. Telegram users at `tg:12345` need high-volume programmatic
storage with proper isolation. One library, two backends, picked by prefix.

Override the home directory via `$ACORE_HOME`. Override the engine DB
location via `$AMAN_ENGINE_DB` (provided by `aman-core`).

### Multi-tenant in practice

```typescript
import { withScope } from "@aman_asmuei/aman-core";
import { getIdentity, updateSection } from "@aman_asmuei/acore-core";

// In aman-tg's bot handler — every Telegram update gets its own scope:
bot.on("message", async (ctx) => {
  const scope = `tg:${ctx.from.id}`;
  await withScope(scope, async () => {
    // No need to pass scope explicitly — it propagates via AsyncLocalStorage
    const identity = await getIdentity();
    if (!identity) {
      await updateSection("User", `- Name: ${ctx.from.first_name}`);
    }
    // ... handle the message
  });
});

// Two concurrent users at the same instant — no bleed:
await Promise.all([
  withScope("tg:alice", () => updateSection("Personality", "Alice's vibe")),
  withScope("tg:bob",   () => updateSection("Personality", "Bob's vibe")),
]);
// → Alice's identity at tg:alice has "Alice's vibe"
// → Bob's identity at tg:bob has "Bob's vibe"
// → They never see each other's data, even though they ran in parallel
```

This pattern is **proven in production** by `aman-tg`'s `apps/api/src/memory.ts`
which has been using the same `tg:${telegramId}` convention for months.

---

## API reference

### Read

| Symbol                                       | Returns                  | Purpose                                                       |
|---------------------------------------------|--------------------------|---------------------------------------------------------------|
| `getIdentity(scope?)`                       | `Promise<Identity \| null>` | Read identity for scope; null if missing                      |
| `getOrCreateIdentity(scope?)`               | `Promise<Identity>`      | Read identity, bootstrapping from template if missing         |
| `getSectionContent(name, scope?)`           | `Promise<string \| null>`   | Read a single section's body                                  |
| `listIdentityScopes()`                      | `Promise<{markdown, database}>` | List all stored scopes across both backends             |

### Write

| Symbol                                       | Returns        | Purpose                                                |
|---------------------------------------------|----------------|--------------------------------------------------------|
| `putIdentity(identity, scope?)`             | `Promise<void>` | Replace the entire identity                            |
| `updateSection(name, content, scope?)`      | `Promise<void>` | Update one section's body; bootstraps if missing       |
| `updateDynamics(update, scope?)`            | `Promise<void>` | Surgical update of `currentRead` / `energy` / `activeMode` bullets |
| `deleteIdentity(scope?)`                    | `Promise<void>` | Remove the identity for a scope                        |

### Pure section helpers

For when you already have an `Identity` in hand and don't want to round-trip storage:

| Symbol                            | Returns       | Purpose                                          |
|----------------------------------|---------------|--------------------------------------------------|
| `getSection(identity, name)`     | `string \| null` | Read a section's body                           |
| `setSection(identity, name, c)`  | `Identity`    | Replace a section's body, return new Identity   |
| `setBulletField(id, field, v)`   | `Identity`    | Update a `- field: value` bullet                |
| `getBulletField(id, field)`      | `string \| null` | Read a `- field: value` bullet                  |
| `listSections(identity)`         | `string[]`    | List all top-level section names                 |

### Storage routing

| Symbol                          | Returns                       | Purpose                                          |
|--------------------------------|-------------------------------|--------------------------------------------------|
| `getStorageForScope(scope)`    | `Storage<Identity>`           | Pick the right backend for a scope              |
| `getMarkdownStorage()`         | `MarkdownFileStorage<Identity>` | Cached singleton for `dev:*` scopes            |
| `getDatabaseStorage()`         | `DatabaseStorage<Identity>`   | Cached singleton for everything else             |
| `getAcoreHome()`               | `string`                      | Root directory (`$ACORE_HOME` or `~/.acore`)    |

### Migration

| Symbol                          | Returns                  | Purpose                                          |
|--------------------------------|--------------------------|--------------------------------------------------|
| `migrateLegacyAcoreFile()`     | `AcoreMigrationReport`   | One-time copy of `~/.acore/core.md` → `~/.acore/dev/default/core.md` |
| `defaultIdentityTemplate(scope)` | `Identity`             | Default markdown template for a new scope        |

The legacy migration is idempotent and **never deletes** the legacy file.
Safe to call multiple times.

---

## Architecture

`acore-core` is one of three "essential" layer libraries in the aman engine v1:

```
                    ┌──────────────────────────┐
                    │     aman engine v1       │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │   aman-core        │  │ ← shared substrate
                    │  │   Scope, Storage   │  │
                    │  └─────────┬──────────┘  │
                    │            │             │
                    │       ┌────┴─────┐       │
                    │       │          │       │
                    │       ▼          ▼       │
                    │  ┌─────────┐ ┌─────────┐ │
                    │  │ acore-  │ │ arules- │ │
                    │  │ core    │ │ core    │ │
                    │  │ ←YOU    │ │         │ │
                    │  │ identity│ │ rules   │ │
                    │  └─────────┘ └─────────┘ │
                    └──────────────────────────┘
                              ▲
                              │ consumed by
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   aman-mcp             aman-agent              aman-tg
   (MCP server         (CLI runtime)         (Telegram backend)
    aggregator)
```

**Where consumers use it**:

- `aman-mcp` exposes `acore-core` via MCP tools (`identity_read`,
  `identity_summary`, `identity_update_section`, `identity_update_dynamics`,
  `avatar_prompt`) — all scope-aware
- `aman-agent` calls `acore-core` directly from its `/identity` slash command
- `aman-tg`'s per-user agents store per-Telegram-user personalities through
  `acore-core` with `tg:${telegramId}` scopes (planned)

---

## What this is NOT

To stay focused, `acore-core` deliberately does not provide:

- **Authentication.** Identity ≠ auth. `acore-core` manages "what the AI
  knows about you," not "who you are to the system." Use your existing
  auth system; pass the user ID in as the scope.
- **Personality generation.** This is storage + helpers, not an LLM
  prompt-engineering library.
- **Schema enforcement.** The markdown blob is intentionally flexible.
  Add or remove sections as needed.
- **A CLI.** That's `@aman_asmuei/acore`. This package is the library
  the CLI will eventually wrap.

---

## Quality signals

- **57 unit tests, all passing**, across 3 test files:
  - `identity.test.ts` — 21 tests covering section parsing, mutation, special
    chars in section names, multi-line bodies, bullet field updates, isolation
  - `api.test.ts` — 29 tests covering scope routing, get/update/delete,
    `withScope` propagation, multi-tenant isolation, dev-vs-tg backend split
  - `migrate.test.ts` — 7 tests covering idempotent legacy migration with
    byte-exact preservation
- **`tsc --noEmit` clean** with `strict` mode
- **A real bug was caught during testing**: the section parser initially used
  the `m` regex flag which made `$` match end-of-line, collapsing section
  bodies to a single line. The fix is documented in the source. Tests caught
  it on the first run.

---

## The aman ecosystem

`acore-core` is one of several packages in the aman AI companion ecosystem:

| Layer                                                                   | Role                                                |
|------------------------------------------------------------------------|-----------------------------------------------------|
| [@aman_asmuei/aman-core](https://github.com/amanasmuei/aman-core)       | Substrate — Scope, Storage, withScope               |
| **[@aman_asmuei/acore-core](https://github.com/amanasmuei/acore-core)** | **Identity layer (this package)**                   |
| [@aman_asmuei/arules-core](https://github.com/amanasmuei/arules-core)   | Guardrails layer — rule parsing and runtime checks  |
| [@aman_asmuei/amem-core](https://github.com/amanasmuei/amem)            | Memory layer — semantic recall, embeddings          |
| [@aman_asmuei/aman-mcp](https://github.com/amanasmuei/aman-mcp)         | MCP server aggregating all layers for any host      |
| [@aman_asmuei/aman-agent](https://github.com/amanasmuei/aman-agent)     | Standalone CLI runtime, multi-LLM, scope-aware      |
| [@aman_asmuei/acore](https://github.com/amanasmuei/acore)               | Single-user CLI — predates this library             |
| [aman-claude-code](https://github.com/amanasmuei/aman-claude-code)                | Claude Code plugin (hooks + skills + MCP installer) |
| [@aman_asmuei/aman](https://github.com/amanasmuei/aman)                 | Umbrella installer — one command for the ecosystem  |

---

## License

[MIT](LICENSE) © Aman Asmuei

---

<div align="center">
  <sub>Built with ❤️ in 🇲🇾 <strong>Malaysia</strong> · Part of the <a href="https://github.com/amanasmuei">aman ecosystem</a></sub>
</div>
