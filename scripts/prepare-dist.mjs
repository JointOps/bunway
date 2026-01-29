import { promises as fs } from "fs";
import { join } from "path";

// Read version from VERSION file (source of truth)
const version = (await fs.readFile("VERSION", "utf8")).trim();
const rootPkg = JSON.parse(await fs.readFile("package.json", "utf8"));

// Ensure package.json is in sync with VERSION
if (rootPkg.version !== version) {
  rootPkg.version = version;
  await fs.writeFile("package.json", JSON.stringify(rootPkg, null, 2) + "\n");
  console.log(`Synced package.json version to ${version}`);
}

const distDir = "dist";
const srcDir = "src";
await fs.mkdir(distDir, { recursive: true });

const distPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  description: rootPkg.description,
  type: "module",
  main: "./index.js",
  module: "./index.js",
  exports: {
    ".": {
      bun: "./index.js",
      import: "./index.js",
      types: "./index.d.ts",
    },
    "./package.json": "./package.json",
  },
  types: "./index.d.ts",
  files: ["**/*.js", "**/*.d.ts", "**/*.map", "README.md", "LICENSE"],
  engines: { bun: ">=1.0.0" },
  keywords: rootPkg.keywords,
  license: rootPkg.license,
  repository: rootPkg.repository,
  homepage: rootPkg.homepage,
  bugs: rootPkg.bugs,
  author: rootPkg.author,
};

await fs.writeFile(join(distDir, "package.json"), JSON.stringify(distPkg, null, 2) + "\n");

// copy the readme from src/ and the license from root
const readmeSource = join(srcDir, "README.md");

await fs.copyFile(readmeSource, join(distDir, "README.md"));
await fs.copyFile("LICENSE", join(distDir, "LICENSE"));
