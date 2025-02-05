import * as esbuild from 'esbuild';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const parentDir = path.resolve(currentDir, "..");
const distDir = path.resolve(parentDir, "dist");

const isWatchMode = process.argv.includes('--watch');

// Ensure dist directory exists
await fs.mkdir(distDir, { recursive: true });

try {
  const files = await fs.readdir(parentDir);
  const lambdaFiles = files.filter(file => 
    (file.endsWith('.js') || file.endsWith('.mjs')) && 
    !file.startsWith('.') && 
    file !== 'package.json' &&
    !file.includes('create-functions') &&
    !file.includes('build')
  );

  for (const file of lambdaFiles) {
    const entryPoint = path.resolve(parentDir, file);
    // Always output as .js regardless of input extension
    const outfile = path.resolve(distDir, file.replace(/\.mjs$/, '.js'));

    const buildOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile,
      format: 'cjs',
      minify: false,
      sourcemap: true,
      mainFields: ['main', 'module'],
      // Only keep Node.js built-in modules as external
      external: [
        'util',
        'crypto',
        'fs',
        'path',
        'os',
        'child_process',
        'stream',
        'net',
        'tls',
        'http',
        'https',
        'zlib',
        'events'
      ]
    };

    if (isWatchMode) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log(`Watching ${file} for changes...`);
    } else {
      await esbuild.build(buildOptions);
      console.log(`Built ${file}`);
    }
  }
} catch (err) {
  console.error("Error building functions:", err);
  process.exit(1);
}
