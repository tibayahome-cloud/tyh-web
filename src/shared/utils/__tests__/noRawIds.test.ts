/**
 * Screens name things by service, person and date, never by the start of an id. The one place an id fragment may be
 * built is bookingReference(), for the rare call to support or an M-Pesa account number. This fails when a component
 * slices an id for display anywhere else, so the problem does not come back.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..", "..");
const ALLOWED = new Set(["shared/utils/bookingReference.ts"]);
// something that looks like an id or reference, then .slice(0, n)
const ID_SLICE = /\b\w*(?:[iI]d|[rR]eference|[rR]ef)\??\.slice\(\s*0\s*,\s*\d+\s*\)/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });

describe("no raw ids in what people read", () => {
  it("never slices an id for display outside bookingReference", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file: relative(SRC, file), text: readFileSync(file, "utf8") }))
      .filter(({ file }) => !ALLOWED.has(file))
      .flatMap(({ file, text }) =>
        text
          .split("\n")
          .map((line, index) => ({ file, line: index + 1, content: line.trim() }))
          .filter(({ content }) => ID_SLICE.test(content))
      );

    expect(offenders).toEqual([]);
  });

  it("does catch a slice of an id", () => {
    expect(ID_SLICE.test("{booking.id.slice(0, 8)}")).toBe(true);
    expect(ID_SLICE.test("txn.referenceId?.slice(0, 8)")).toBe(true);
    expect(ID_SLICE.test("name.slice(0, 8)")).toBe(false);
  });
});
