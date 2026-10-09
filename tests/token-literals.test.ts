import { execFileSync } from "node:child_process";

const run = (roots: string[]) =>
  execFileSync("node", ["scripts/check-token-literals.mjs", ...roots], {
    encoding: "utf8",
  });
const runExpectFail = (roots: string[]) => {
  try {
    execFileSync("node", ["scripts/check-token-literals.mjs", ...roots], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return null;
  } catch (e: any) {
    return { status: e.status as number, stderr: e.stderr as string };
  }
};

describe("token-literal ban gate", () => {
  it("passes on the real tree (app/, src/)", () => {
    expect(() => run([])).not.toThrow();
  });

  it("flags hex literals in a dirty fixture and exits 1", () => {
    const r = runExpectFail(["tests/fixtures/dirty"]);
    expect(r).not.toBeNull();
    expect(r!.status).toBe(1);
    expect(r!.stderr).toContain("tests/fixtures/dirty/bad-color.tsx");
    expect(r!.stderr).toContain("#ff0000");
  });

  it("ignores non-TS files and comment lines", () => {
    // clean fixture passes
    expect(() => run(["tests/fixtures/clean"])).not.toThrow();
  });

  it("default run includes tokens.generated.ts in its ALLOW list (will exist from Task 3)", () => {
    // the gate must not flag the generated token module when it appears
    expect(() => run([])).not.toThrow();
  });
});
