import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { buildPagesSite } from "./build-pages-site.mjs";

function readText(path) {
  return readFileSync(path, "utf8");
}

describe("GitHub Pages marketing site", () => {
 it("defines separate marketing routes demo dropdown navigation", () => {
   const html = readText("clients/test-page/index.html");

   assert.match(html, /class="marketing-view"[^>]*data-view="home"/);
   assert.match(html, /class="marketing-view"[^>]*data-view="install"/);
   assert.match(html, /class="marketing-view"[^>]*data-view="privacy"/);
   assert.match(html, /class="marketing-view"[^>]*data-view="faq"/);
   assert.match(html, /class="demo-view"[^>]*data-view="read"/);
   assert.match(html, /class="demo-view"[^>]*data-view="parse"/);
   assert.match(html, /class="demo-view"[^>]*data-view="actions"/);
   assert.match(html, /class="demo-view"[^>]*data-view="downloads"/);

   assert.match(html, /Functionalities and Demo/);
    assert.match(html, /data-demo-nav/);
    assert.doesNotMatch(html, /aria-haspopup="true"/);
    assert.match(html, /href="#read" data-route="read" data-demo-nav/);

   assert.match(html, /content\/download-and-install\.md/);
   assert.match(html, /content\/privacy-policy\.md/);
   assert.match(html, /content\/faq\.md/);
 });

  it("keeps main navigation visible on demo routes", () => {
    const html = readText("clients/test-page/index.html");

    assert.match(html, /<header class="topbar">/);
    assert.doesNotMatch(
      html,
      /\.shell\[data-route-type="demo"\]\s+\.topbar\s*\{[\s\S]*display:\s*none/,
    );
    assert.match(
      html,
      /setAttribute\("data-route-type",\s*routes\[viewName\]\.type\)/,
    );
  });

  it("does not render duplicate SPA headers before embedded demo content", () => {
    const html = readText("clients/test-page/index.html");

    assert.doesNotMatch(
      html,
      /<section class="demo-view"[^>]*data-view="(?:read|parse|actions|downloads)"[^>]*>\s*<header class="demo-header">/,
    );
  });

  it("centers the demo sub-nav buttons in the narrow navigation layout", () => {
    const html = readText("clients/test-page/index.html");

    assert.match(
      html,
      /@media \(max-width: 760px\)[\s\S]*\.demo-subnav a\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-content:\s*center;/,
    );
  });

  it("keeps install privacy faq content in markdown source files", () => {
    const install = readText("docs/artifacts/download-and-install.md");
    const privacy = readText("clients/extensions/chrome/PRIVACY-POLICY.md");
    const faq = readText("docs/artifacts/faq.md");

    assert.match(install, /^# Download and Install/m);
    assert.match(install, /npx @brijio\/mcp install/);
    assert.match(privacy, /^# Brijio Privacy Policy/m);
    assert.match(privacy, /No telemetry/);
    assert.match(faq, /^# FAQ/m);
    assert.match(faq, /Does Brijio continuously stream browser data/);
  });

  it("keeps local marketing markdown content synced with source files", () => {
    const contentFiles = [
      {
        source: "docs/artifacts/download-and-install.md",
        target: "download-and-install.md",
      },
      {
        source: "clients/extensions/chrome/PRIVACY-POLICY.md",
        target: "privacy-policy.md",
      },
      { source: "docs/artifacts/faq.md", target: "faq.md" },
    ];
    const localRoots = ["clients/test-page/content", "servers/mcp/demo/content"];

    for (const root of localRoots) {
      for (const file of contentFiles) {
        const targetPath = join(root, file.target);

        assert.equal(existsSync(targetPath), true, `${targetPath} exists`);
        assert.equal(readText(targetPath), readText(file.source));
      }
    }
  });

  it("assembles pages artifact copied markdown content", async () => {
    const root = mkdtempSync(join(tmpdir(), "brijio-pages-"));
    const outputDir = join(root, "site");

    try {
      await buildPagesSite({ outputDir });

      assert.equal(existsSync(join(outputDir, "index.html")), true);
      assert.equal(existsSync(join(outputDir, "assets", "brijio-mark.svg")), true);
      assert.equal(
        existsSync(join(outputDir, "content", "download-and-install.md")),
        true,
      );
      assert.equal(existsSync(join(outputDir, "content", "privacy-policy.md")), true);
      assert.equal(existsSync(join(outputDir, "content", "faq.md")), true);

      assert.equal(
        readText(join(outputDir, "content", "privacy-policy.md")),
        readText("clients/extensions/chrome/PRIVACY-POLICY.md"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
