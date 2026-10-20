import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArg(name) {
  return process.argv.find(arg => arg.startsWith(`${name}=`));
}

const outdirArg = parseArg('--outdir');
const outdir = outdirArg
  ? path.resolve(outdirArg.slice('--outdir='.length))
  : path.resolve(__dirname, '../adminhost/web/admin/assetpack');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const buildOptions = {
  entryPoints: [path.resolve(__dirname, 'src/app/main.tsx')],
  bundle: true,
  outdir,
  entryNames: 'app',
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  sourcemap: isProduction ? false : 'linked',
  minify: isProduction,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
  },
  logLevel: 'info'
};

if (isWatch) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log(`[esbuild] Watching src/app/main.tsx -> ${outdir}`);
}
else {
  await esbuild.build(buildOptions);
}