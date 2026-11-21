// Validate the files served from the GitHub Pages artifact before deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('published files exist and are not empty', () => {
  for (const name of [
    'index.html', 'assets/styles.css', 'src/app.js',
    'src/analytics.js', 'data/nvda-history-1999-2024.csv'
  ]) {
    assert.ok(statSync(resolve(root, name)).size > 0, `missing or empty: ${name}`);
  }
});

test('HTML links and ESM imports resolve at the Pages project base path', () => {
  const html = read('index.html');
  assert.match(html, /href="\.\/assets\/styles\.css"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.match(html, /NVDA Insights Studio/);
  const module = read('src/app.js');
  assert.match(module, /from ['"]\.\/analytics\.js['"]/);
  const sourceMatch = module.match(/const DEMO=['"]([^'"]+)['"]/);
  assert.ok(sourceMatch, 'demo dataset path not found');
  assert.ok(statSync(resolve(root, sourceMatch[1])).size > 1000);
  assert.match(read(sourceMatch[1]).split(/\r?\n/)[0], /^Date,Open,High,Low,Close,Volume/);
});
