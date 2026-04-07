import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { migrateLegacyAcoreFile, _resetStorageCache } from "../src/index.js";

describe("migrateLegacyAcoreFile", () => {
  let tmpRoot: string;
  let acoreHome: string;
  let legacyPath: string;
  let newPath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acore-core-migrate-"));
    acoreHome = path.join(tmpRoot, "acore");
    fs.mkdirSync(acoreHome, { recursive: true });
    process.env.ACORE_HOME = acoreHome;
    _resetStorageCache();
    legacyPath = path.join(acoreHome, "core.md");
    newPath = path.join(acoreHome, "dev", "default", "core.md");
  });

  afterEach(() => {
    _resetStorageCache();
    delete process.env.ACORE_HOME;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns no-op when no legacy file exists", () => {
    const report = migrateLegacyAcoreFile();
    expect(report.status).toBe("no-op");
    expect(report.message).toMatch(/No legacy file/);
    expect(fs.existsSync(newPath)).toBe(false);
  });

  it("copies legacy file to new path when only legacy exists", () => {
    fs.writeFileSync(legacyPath, "## A\nbody\n", "utf-8");

    const report = migrateLegacyAcoreFile();
    expect(report.status).toBe("copied");
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.readFileSync(newPath, "utf-8")).toBe("## A\nbody\n");
  });

  it("does NOT delete the legacy file after copying", () => {
    fs.writeFileSync(legacyPath, "## A\nbody\n", "utf-8");
    migrateLegacyAcoreFile();
    expect(fs.existsSync(legacyPath)).toBe(true);
  });

  it("returns no-op when both legacy and new exist", () => {
    fs.writeFileSync(legacyPath, "legacy content", "utf-8");
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.writeFileSync(newPath, "new content", "utf-8");

    const report = migrateLegacyAcoreFile();
    expect(report.status).toBe("no-op");
    expect(report.message).toMatch(/already exists/);
    // New file is unchanged
    expect(fs.readFileSync(newPath, "utf-8")).toBe("new content");
  });

  it("is idempotent — running twice yields the same final state", () => {
    fs.writeFileSync(legacyPath, "## Personality\nWarm\n", "utf-8");

    const first = migrateLegacyAcoreFile();
    expect(first.status).toBe("copied");

    const second = migrateLegacyAcoreFile();
    expect(second.status).toBe("no-op");

    expect(fs.readFileSync(newPath, "utf-8")).toBe("## Personality\nWarm\n");
  });

  it("creates intermediate directories for the new path", () => {
    fs.writeFileSync(legacyPath, "x", "utf-8");
    expect(fs.existsSync(path.dirname(newPath))).toBe(false);
    migrateLegacyAcoreFile();
    expect(fs.existsSync(path.dirname(newPath))).toBe(true);
  });

  it("preserves the exact bytes of the legacy file", () => {
    const original = "# Header\n\n- Bullet 1\n- Bullet 2\n\n## Section\nbody\n";
    fs.writeFileSync(legacyPath, original, "utf-8");
    migrateLegacyAcoreFile();
    expect(fs.readFileSync(newPath, "utf-8")).toBe(original);
  });
});
