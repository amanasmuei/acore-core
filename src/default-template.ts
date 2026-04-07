import type { Identity } from "./identity.js";

/**
 * Build a default identity template for a newly-created scope. The template
 * matches the section structure that the existing acore CLI uses, so any
 * downstream tool that expects `## User`, `## Personality`, `## Session`,
 * `## Dynamics` etc. keeps working without changes.
 *
 * The scope string is embedded in the document so that, when a user opens
 * the file in vim, they immediately know which scope they're editing.
 */
export function defaultIdentityTemplate(scope: string): Identity {
  const today = new Date().toISOString().split("T")[0];
  return {
    content: `# Aman

> Your AI companion (scope: ${scope})

## User
- Name: [your name]
- Role: [your role]

## Personality
[Describe how the AI should behave — tone, values, conversational style.]

## Session
- Last updated: ${today}
- Resume: [where we left off]
- Active topics:
- Recent decisions:

## Dynamics
- Current read: neutral
- Baseline energy: steady
- Active mode: Default
`,
  };
}
