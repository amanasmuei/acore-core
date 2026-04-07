import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { withScope } from "@aman_asmuei/aman-core";
import {
  getIdentity,
  getOrCreateIdentity,
  getSectionContent,
  putIdentity,
  updateSection,
  updateDynamics,
  deleteIdentity,
  listIdentityScopes,
  getStorageForScope,
  getMarkdownStorage,
  getDatabaseStorage,
  _resetStorageCache,
  getBulletField,
  type Identity,
} from "../src/index.js";

describe("acore-core public API", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acore-core-api-"));
    process.env.ACORE_HOME = path.join(tmpRoot, "acore");
    process.env.AMAN_ENGINE_DB = path.join(tmpRoot, "engine.db");
    _resetStorageCache();
  });

  afterEach(() => {
    _resetStorageCache();
    delete process.env.ACORE_HOME;
    delete process.env.AMAN_ENGINE_DB;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe("storage routing", () => {
    it("dev:* scopes route to MarkdownFileStorage", () => {
      const storage = getStorageForScope("dev:default");
      expect(storage).toBe(getMarkdownStorage());
    });

    it("dev:plugin routes to MarkdownFileStorage", () => {
      const storage = getStorageForScope("dev:plugin");
      expect(storage).toBe(getMarkdownStorage());
    });

    it("tg:* scopes route to DatabaseStorage", () => {
      const storage = getStorageForScope("tg:12345");
      expect(storage).toBe(getDatabaseStorage());
    });

    it("agent:* scopes route to DatabaseStorage", () => {
      const storage = getStorageForScope("agent:jiran");
      expect(storage).toBe(getDatabaseStorage());
    });

    it("unknown frontend prefixes default to DatabaseStorage", () => {
      const storage = getStorageForScope("unknown:something");
      expect(storage).toBe(getDatabaseStorage());
    });
  });

  describe("getIdentity", () => {
    it("returns null when no identity exists", async () => {
      expect(await getIdentity("dev:default")).toBeNull();
      expect(await getIdentity("tg:12345")).toBeNull();
    });

    it("returns the identity after putIdentity", async () => {
      const id: Identity = { content: "## Personality\nWarm" };
      await putIdentity(id, "dev:default");
      const result = await getIdentity("dev:default");
      expect(result?.content).toBe("## Personality\nWarm");
    });

    it("uses active withScope when no explicit scope is given", async () => {
      await withScope("dev:plugin", async () => {
        await updateSection("Test", "from withScope");
        const id = await getIdentity();
        expect(id?.content).toContain("## Test\nfrom withScope");
      });
    });

    it("falls back to dev:default when no scope is active", async () => {
      await updateSection("FallbackTest", "implicit dev:default");
      const id = await getIdentity();
      expect(id?.content).toContain("FallbackTest");
    });
  });

  describe("getOrCreateIdentity", () => {
    it("creates a default template when none exists", async () => {
      const id = await getOrCreateIdentity("dev:default");
      expect(id.content).toContain("# Aman");
      expect(id.content).toContain("scope: dev:default");
      expect(id.content).toContain("## User");
      expect(id.content).toContain("## Personality");
      expect(id.content).toContain("## Dynamics");
    });

    it("returns the existing identity if one already exists", async () => {
      await putIdentity({ content: "custom content" }, "dev:default");
      const id = await getOrCreateIdentity("dev:default");
      expect(id.content).toBe("custom content");
    });

    it("creates a per-scope identity in DatabaseStorage for tg scopes", async () => {
      const id = await getOrCreateIdentity("tg:12345");
      expect(id.content).toContain("scope: tg:12345");
      // Verify it's in the DB
      const fromDb = await getDatabaseStorage().get("tg:12345");
      expect(fromDb?.content).toContain("scope: tg:12345");
    });

    it("creates a per-agent identity in DatabaseStorage for agent scopes", async () => {
      const id = await getOrCreateIdentity("agent:jiran");
      expect(id.content).toContain("scope: agent:jiran");
    });
  });

  describe("updateSection", () => {
    it("creates the identity from default and writes the section", async () => {
      await updateSection("Personality", "Warm and direct", "dev:default");
      const id = await getIdentity("dev:default");
      expect(id?.content).toContain("Warm and direct");
    });

    it("preserves other sections when updating one", async () => {
      await updateSection("Personality", "v1", "dev:default");
      await updateSection("Personality", "v2", "dev:default");
      const id = await getIdentity("dev:default");
      expect(id?.content).toContain("## Personality\nv2");
      expect(id?.content).toContain("## User");
      expect(id?.content).toContain("## Dynamics");
    });

    it("appends a new section if it doesn't exist in the template", async () => {
      await updateSection("CustomGoals", "Ship engine v1", "dev:default");
      const id = await getIdentity("dev:default");
      expect(id?.content).toContain("## CustomGoals\nShip engine v1");
    });
  });

  describe("updateDynamics", () => {
    it("updates current read", async () => {
      await updateDynamics({ currentRead: "late-night, focused" }, "dev:default");
      const id = await getIdentity("dev:default");
      expect(getBulletField(id!, "Current read")).toBe("late-night, focused");
    });

    it("updates energy and activeMode independently", async () => {
      await updateDynamics(
        { energy: "high-drive", activeMode: "Focused Work" },
        "dev:default",
      );
      const id = await getIdentity("dev:default");
      expect(getBulletField(id!, "Baseline energy")).toBe("high-drive");
      expect(getBulletField(id!, "Active mode")).toBe("Focused Work");
      // Current read unchanged from default template
      expect(getBulletField(id!, "Current read")).toBe("neutral");
    });

    it("updates all three fields together", async () => {
      await updateDynamics(
        {
          currentRead: "energetic",
          energy: "high-drive",
          activeMode: "Creative",
        },
        "dev:default",
      );
      const id = await getIdentity("dev:default");
      expect(getBulletField(id!, "Current read")).toBe("energetic");
      expect(getBulletField(id!, "Baseline energy")).toBe("high-drive");
      expect(getBulletField(id!, "Active mode")).toBe("Creative");
    });

    it("works for tg scopes via DatabaseStorage", async () => {
      await updateDynamics(
        { currentRead: "tired" },
        "tg:12345",
      );
      const id = await getIdentity("tg:12345");
      expect(getBulletField(id!, "Current read")).toBe("tired");
    });
  });

  describe("getSectionContent", () => {
    it("reads a section from the stored identity", async () => {
      await updateSection("Personality", "Direct", "dev:default");
      const content = await getSectionContent("Personality", "dev:default");
      expect(content).toBe("Direct");
    });

    it("returns null when no identity exists", async () => {
      expect(await getSectionContent("Personality", "tg:99999")).toBeNull();
    });
  });

  describe("isolation between scopes", () => {
    it("dev:default and tg:12345 do not see each other's data", async () => {
      await updateSection("Personality", "dev personality", "dev:default");
      await updateSection("Personality", "tg personality", "tg:12345");

      expect(await getSectionContent("Personality", "dev:default")).toBe(
        "dev personality",
      );
      expect(await getSectionContent("Personality", "tg:12345")).toBe(
        "tg personality",
      );
    });

    it("two different tg users do not see each other's identity", async () => {
      await updateSection("Personality", "user a's personality", "tg:user-a");
      await updateSection("Personality", "user b's personality", "tg:user-b");

      expect(await getSectionContent("Personality", "tg:user-a")).toBe(
        "user a's personality",
      );
      expect(await getSectionContent("Personality", "tg:user-b")).toBe(
        "user b's personality",
      );
    });

    it("dev scopes write to filesystem, tg scopes write to DB — separate physical locations", async () => {
      await updateSection("Personality", "in markdown", "dev:default");
      await updateSection("Personality", "in db", "tg:12345");

      // Markdown file exists at the expected path
      const expectedFile = path.join(
        process.env.ACORE_HOME!,
        "dev",
        "default",
        "core.md",
      );
      expect(fs.existsSync(expectedFile)).toBe(true);

      // No file for the tg scope (it's in the DB)
      const tgFile = path.join(
        process.env.ACORE_HOME!,
        "tg",
        "12345",
        "core.md",
      );
      expect(fs.existsSync(tgFile)).toBe(false);

      // The engine DB exists
      expect(fs.existsSync(process.env.AMAN_ENGINE_DB!)).toBe(true);
    });
  });

  describe("withScope propagation", () => {
    it("two parallel withScope blocks do not bleed identities", async () => {
      const results = await Promise.all([
        withScope("tg:user-a", async () => {
          await updateDynamics({ currentRead: "user a's mood" });
          await new Promise((r) => setTimeout(r, 5));
          const id = await getIdentity();
          return getBulletField(id!, "Current read");
        }),
        withScope("tg:user-b", async () => {
          await updateDynamics({ currentRead: "user b's mood" });
          await new Promise((r) => setTimeout(r, 3));
          const id = await getIdentity();
          return getBulletField(id!, "Current read");
        }),
      ]);
      expect(results).toEqual(["user a's mood", "user b's mood"]);
    });
  });

  describe("deleteIdentity", () => {
    it("removes the identity for a scope", async () => {
      await putIdentity({ content: "## A\nbody" }, "dev:default");
      await deleteIdentity("dev:default");
      expect(await getIdentity("dev:default")).toBeNull();
    });

    it("is a no-op when no identity exists", async () => {
      await expect(deleteIdentity("dev:never-existed")).resolves.toBeUndefined();
    });
  });

  describe("listIdentityScopes", () => {
    it("returns scopes from both backends", async () => {
      await updateSection("X", "x", "dev:default");
      await updateSection("X", "x", "dev:plugin");
      await updateSection("X", "x", "tg:111");
      await updateSection("X", "x", "agent:jiran");

      const { markdown, database } = await listIdentityScopes();
      expect(markdown.sort()).toEqual(["dev:default", "dev:plugin"]);
      expect(database.sort()).toEqual(["agent:jiran", "tg:111"]);
    });
  });
});
