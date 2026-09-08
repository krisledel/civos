import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
fs.mkdirSync('work', { recursive: true });
for (const [src, name] of [
  ['lib/model.ts', 'model'],
  ['lib/presentation.ts', 'presentation'],
  ['lib/bundles.ts', 'bundles'],
  ['tests/integration.ts', 'integration'],
]) {
  const code = fs
    .readFileSync(src, 'utf8')
    .replaceAll("'../lib/model'", "'./model.mjs'")
    .replaceAll("'../lib/presentation'", "'./presentation.mjs'")
    .replaceAll("'../lib/bundles'", "'./bundles.mjs'")
    .replaceAll("'./model'", "'./model.mjs'");
  fs.writeFileSync(
    'work/' + name + '.mjs',
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const result = spawnSync(process.execPath, ['work/integration.mjs'], {
  stdio: 'inherit',
});
if (result.status !== 0)
  throw Error(`Integration test exited with ${result.status}`);
