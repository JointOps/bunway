import { promises as fs } from 'fs';
import { execSync } from 'child_process';

const rootPkgPath = new URL('../package.json', import.meta.url);
const distPkgPath = new URL('../dist/package.json', import.meta.url);

async function ensureFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch (err) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

async function main() {
  const [rootPkgRaw, distPkgRaw] = await Promise.all([
    fs.readFile(rootPkgPath, 'utf8'),
    fs.readFile(distPkgPath, 'utf8'),
  ]);

  const rootPkg = JSON.parse(rootPkgRaw);
  const distPkg = JSON.parse(distPkgRaw);

  if (rootPkg.name !== distPkg.name) {
    throw new Error(`Package name mismatch: root(${rootPkg.name}) vs dist(${distPkg.name})`);
  }

  if (rootPkg.version !== distPkg.version) {
    throw new Error(`Version mismatch: root(${rootPkg.version}) vs dist(${distPkg.version})`);
  }

  const requiredFiles = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/package.json',
    'dist/README.md',
    'dist/LICENSE',
  ];

  await Promise.all(
    requiredFiles.map((file) => ensureFileExists(new URL(`../${file}`, import.meta.url)))
  );

  // Skip git status check in CI environment (files may change during build)
  if (!process.env.CI) {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (gitStatus) {
      throw new Error('Working tree is dirty. Commit or stash changes before releasing.');
    }
  }

  try {
    const publishedVersionsRaw = execSync(`npm view ${rootPkg.name} versions --json`, {
      encoding: 'utf8',
    }).trim();
    const publishedVersions = publishedVersionsRaw ? JSON.parse(publishedVersionsRaw) : [];
    if (Array.isArray(publishedVersions) && publishedVersions.includes(rootPkg.version)) {
      throw new Error(`Version ${rootPkg.version} is already published on npm.`);
    }
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    if (!output.includes('E404')) {
      throw new Error(`npm view failed: ${output}`);
    }
  }

  console.log('✔ dist package looks good. Ready to publish.');
}

main().catch((err) => {
  console.error(`✖ dist verification failed: ${err.message}`);
  process.exit(1);
});
