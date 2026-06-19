import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const contentFiles = [
  {
    source: "docs/artifacts/download-and-install.md",
    target: "download-and-install.md",
  },
  {
    source: "clients/extensions/chrome/PRIVACY-POLICY.md",
    target: "privacy-policy.md",
  },
  {
    source: "docs/artifacts/faq.md",
    target: "faq.md",
  },
];

export async function buildPagesSite(options = {}) {
  const outputDir = resolve(options.outputDir ?? ".pages-site");

  await rm(outputDir, { recursive: true, force: true });
  await cp("clients/test-page", outputDir, { recursive: true });
  await mkdir(resolve(outputDir, "content"), { recursive: true });

  for (const file of contentFiles) {
    await copyFile(file.source, resolve(outputDir, "content", file.target));
  }

  return { outputDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPagesSite({ outputDir: process.argv[2] ?? ".pages-site" });
}
