import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist');
const isWatch = process.argv.includes('--watch');

async function ensureDist() {
  await mkdir(outDir, { recursive: true });
}

async function copyTranslations() {
  const source = path.join(projectRoot, 'i18n');
  const target = path.join(outDir, 'i18n');
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}

async function run() {
  await ensureDist();
  await Promise.all([
    build({
      entryPoints: [path.join(projectRoot, 'src/bootstrap/page-loader.js')],
      bundle: true,
      splitting: true,
      format: 'esm',
      target: ['es2018'],
      sourcemap: true,
      minify: true,
      outdir: outDir,
      logLevel: 'info',
      chunkNames: '[name]-[hash]',
      entryNames: '[name]',
      watch: isWatch
        ? {
            onRebuild(error) {
              if (error) {
                console.error('Erreur de build JS :', error);
              } else {
                console.log('Bundle JS reconstruit');
              }
            }
          }
        : false
    }),
    build({
      entryPoints: [path.join(projectRoot, 'styles.css')],
      bundle: true,
      loader: { '.css': 'css' },
      minify: true,
      sourcemap: true,
      outdir: outDir,
      logLevel: 'info',
      watch: isWatch
        ? {
            onRebuild(error) {
              if (error) {
                console.error('Erreur de build CSS :', error);
              } else {
                console.log('Feuille de style reconstruite');
              }
            }
          }
        : false
    })
  ]);
  await copyTranslations();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
