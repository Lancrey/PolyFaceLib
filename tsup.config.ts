import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    presets: 'src/polyhedra/presets/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: true,
  target: 'es2020',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
  async onSuccess() {
    const dist = resolve('dist');
    if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
    const cssSrc = resolve('src/styles.css');
    if (existsSync(cssSrc)) {
      copyFileSync(cssSrc, resolve(dist, 'styles.css'));
    }
  },
});
