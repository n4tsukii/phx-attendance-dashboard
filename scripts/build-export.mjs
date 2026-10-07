import { existsSync, renameSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'app/api');
const tempApiDir = resolve(root, 'app/_api_hidden');
const dotNext = resolve(root, '.next');
const outDir = resolve(root, 'out');

let renamed = false;
try {
  if (existsSync(dotNext)) {
    console.log('Cleaning .next directory...');
    rmSync(dotNext, { recursive: true, force: true });
  }

  if (existsSync(apiDir)) {
    console.log('Hiding app/api for static export...');
    renameSync(apiDir, tempApiDir);
    renamed = true;
  }

  console.log('Running Next.js static build...');
  execSync('npx next build', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_EXPORT: 'true',
    },
  });

  const nojekyllPath = resolve(outDir, '.nojekyll');
  writeFileSync(nojekyllPath, '');
  console.log('Created out/.nojekyll for GitHub Pages.');

  console.log('Static export completed successfully!');
} catch (err) {
  console.error('Build export failed:', err);
  process.exitCode = 1;
} finally {
  if (renamed && existsSync(tempApiDir)) {
    renameSync(tempApiDir, apiDir);
    console.log('Restored app/api directory.');
  }
}
