import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { describe, it } from "node:test";

describe("repository tooling", () => {
  it("defines root lint and precommit scripts", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    assert.equal(packageJson.scripts.lint, "pnpm lint:ts && pnpm lint:md");
    assert.equal(packageJson.scripts["lint:ts"], "XDG_CACHE_HOME=.cache ts-standard \"**/*.ts\"");
    assert.equal(packageJson.scripts["lint:md"], "prettier --check \"**/*.md\"");
    assert.equal(packageJson.scripts["format:md"], "prettier --write \"**/*.md\"");
    assert.equal(packageJson.scripts.precommit, "scripts/pre-commit");
  });

  it("installs the requested TypeScript and Markdown lint tools", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    assert.equal(typeof packageJson.devDependencies["ts-standard"], "string");
    assert.equal(typeof packageJson.devDependencies.prettier, "string");
  });

  it("provides a root TypeScript project for ts-standard", async () => {
    const tsconfig = JSON.parse(await readFile("tsconfig.eslint.json", "utf8"));

    assert.deepEqual(tsconfig.include, [
      "clients/**/*.ts",
      "packages/**/*.ts",
      "servers/**/*.ts"
    ]);
  });

  it("keeps local tool caches out of git", async () => {
    const gitignore = await readFile(".gitignore", "utf8");

    assert.match(gitignore, /^\.cache$/m);
  });

  it("keeps local pre-commit checks aligned with lint and tests", async () => {
    const script = await readFile("scripts/pre-commit", "utf8");

    assert.match(script, /^#!\/usr\/bin\/env sh\n/);
    assert.match(script, /\bpnpm lint\b/);
    assert.match(script, /\bpnpm test\b/);
    assert.ok(script.indexOf("pnpm lint") < script.indexOf("pnpm test"));
    await access("scripts/pre-commit", constants.X_OK);
  });

  it("validates pull requests with install, build, and test steps", async () => {
    const workflow = await readFile(".github/workflows/pr-validation.yml", "utf8");

    assert.match(workflow, /name: PR Validation/);
    assert.match(workflow, /pull_request:/);
    assert.match(workflow, /node-version: 22/);
    assert.match(workflow, /pnpm install --frozen-lockfile/);
    assert.match(workflow, /pnpm build/);
    assert.match(workflow, /pnpm test/);
  });

  it("runs lint in a dedicated workflow", async () => {
    const workflow = await readFile(".github/workflows/lint.yml", "utf8");

    assert.match(workflow, /name: Lint/);
    assert.match(workflow, /pull_request:/);
    assert.match(workflow, /node-version: 22/);
    assert.match(workflow, /pnpm install --frozen-lockfile/);
    assert.match(workflow, /pnpm lint/);
  });

  it("keeps Docker service networking independent from host .env values", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    assert.match(compose, /WEBSOCKET_HOST: 0\.0\.0\.0/);
    assert.match(compose, /BROWSERBRIDGE_WEBSOCKET_URL: ws:\/\/websocket:8787/);
  });
});
