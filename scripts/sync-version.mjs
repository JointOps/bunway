/**
 * Syncs the version from VERSION file to package.json
 * Run this script before builds/releases to ensure version consistency
 */
import { promises as fs } from "fs";

const version = (await fs.readFile("VERSION", "utf8")).trim();
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));

if (pkg.version !== version) {
  pkg.version = version;
  await fs.writeFile("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Updated package.json version to ${version}`);
} else {
  console.log(`Version already in sync: ${version}`);
}
