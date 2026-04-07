import { describe, it, expect } from "vitest";
import {
  type Identity,
  getSection,
  setSection,
  setBulletField,
  getBulletField,
  listSections,
} from "../src/index.js";

const sample: Identity = {
  content: `# Aman

> Your AI companion

## User
- Name: Aman
- Role: Founder

## Personality
Warm, direct, curious.
Three lines of personality.

## Session
- Last updated: 2026-04-07
- Resume: working on aman engine
- Active topics:

## Dynamics
- Current read: focused
- Baseline energy: steady
- Active mode: Default
`,
};

describe("getSection", () => {
  it("returns the body of an existing section", () => {
    expect(getSection(sample, "Personality")).toBe(
      "Warm, direct, curious.\nThree lines of personality.",
    );
  });

  it("returns null for a missing section", () => {
    expect(getSection(sample, "DoesNotExist")).toBeNull();
  });

  it("returns the User section as a bullet list", () => {
    expect(getSection(sample, "User")).toBe("- Name: Aman\n- Role: Founder");
  });

  it("handles section names with special regex characters", () => {
    const weird: Identity = {
      content: "## My (Section.Name)\nbody here\n## Other\n",
    };
    expect(getSection(weird, "My (Section.Name)")).toBe("body here");
  });

  it("returns the content of the last section in the file", () => {
    expect(getSection(sample, "Dynamics")).toBe(
      "- Current read: focused\n- Baseline energy: steady\n- Active mode: Default",
    );
  });

  it("terminates at a --- separator", () => {
    const withSep: Identity = {
      content: "## A\nbody\n---\n## B\nother\n",
    };
    expect(getSection(withSep, "A")).toBe("body");
  });
});

describe("setSection", () => {
  it("replaces the body of an existing section", () => {
    const updated = setSection(sample, "Personality", "Direct and warm.");
    expect(getSection(updated, "Personality")).toBe("Direct and warm.");
    // Other sections preserved
    expect(getSection(updated, "User")).toBe("- Name: Aman\n- Role: Founder");
    expect(getSection(updated, "Dynamics")).toContain("Current read");
  });

  it("does not mutate the input identity", () => {
    const original = sample.content;
    setSection(sample, "Personality", "Mutated");
    expect(sample.content).toBe(original);
  });

  it("appends a new section when the named one doesn't exist", () => {
    const updated = setSection(sample, "Goals", "Ship engine v1");
    expect(getSection(updated, "Goals")).toBe("Ship engine v1");
    // Existing sections still there
    expect(getSection(updated, "Personality")).toBeTruthy();
  });

  it("trims whitespace from the new content", () => {
    const updated = setSection(sample, "Personality", "  trimmed  \n\n");
    expect(getSection(updated, "Personality")).toBe("trimmed");
  });

  it("preserves sections after the one being updated", () => {
    const updated = setSection(sample, "Personality", "new body");
    expect(getSection(updated, "Session")).toContain("Last updated");
    expect(getSection(updated, "Dynamics")).toContain("Current read");
  });
});

describe("setBulletField", () => {
  it("updates an existing bullet field", () => {
    const updated = setBulletField(sample, "Current read", "late-night, calm");
    expect(getBulletField(updated, "Current read")).toBe("late-night, calm");
  });

  it("returns the identity unchanged when the field is missing", () => {
    const updated = setBulletField(sample, "Nonexistent", "value");
    expect(updated.content).toBe(sample.content);
  });

  it("only updates the first matching field, not all of them", () => {
    const dup: Identity = {
      content: "## A\n- Name: x\n## B\n- Name: y\n",
    };
    const updated = setBulletField(dup, "Name", "z");
    // First match replaced
    expect(updated.content).toContain("- Name: z");
    // Second one unchanged
    expect(updated.content).toContain("- Name: y");
  });

  it("does not affect other bullets in the same section", () => {
    const updated = setBulletField(sample, "Baseline energy", "high-drive");
    expect(getBulletField(updated, "Current read")).toBe("focused");
    expect(getBulletField(updated, "Baseline energy")).toBe("high-drive");
    expect(getBulletField(updated, "Active mode")).toBe("Default");
  });
});

describe("getBulletField", () => {
  it("reads an existing bullet", () => {
    expect(getBulletField(sample, "Name")).toBe("Aman");
    expect(getBulletField(sample, "Role")).toBe("Founder");
    expect(getBulletField(sample, "Current read")).toBe("focused");
  });

  it("returns null for missing fields", () => {
    expect(getBulletField(sample, "DoesNotExist")).toBeNull();
  });

  it("returns empty string for empty bullets", () => {
    const empty: Identity = { content: "## A\n- Empty:\n" };
    expect(getBulletField(empty, "Empty")).toBe("");
  });
});

describe("listSections", () => {
  it("returns all section names in document order", () => {
    expect(listSections(sample)).toEqual([
      "User",
      "Personality",
      "Session",
      "Dynamics",
    ]);
  });

  it("returns empty for an identity with no sections", () => {
    expect(listSections({ content: "no sections here" })).toEqual([]);
  });

  it("ignores h3 and lower headings", () => {
    const mixed: Identity = {
      content: "## Top\n### Sub\nstuff\n## Bottom\n",
    };
    expect(listSections(mixed)).toEqual(["Top", "Bottom"]);
  });
});
