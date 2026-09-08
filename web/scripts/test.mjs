import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
fs.mkdirSync('work', { recursive: true });
for (const [src, name] of [
  ['lib/model.ts', 'model'],
  ['lib/presentation.ts', 'presentation'],
  ['lib/bundles.ts', 'bundles'],
  ['lib/rational.ts', 'rational'],
  ['lib/kernel.ts', 'kernel'],
  ['lib/kernel-records.ts', 'kernel-records'],
  ['lib/kernel-example-data.ts', 'kernel-example-data'],
  ['tests/kernel.ts', 'kernel-test'],
  ['tests/record-regressions.ts', 'record-regressions'],
  ['tests/integration.ts', 'integration'],
]) {
  let code = fs.readFileSync(src, 'utf8');
  for (const moduleName of [
    'model',
    'presentation',
    'bundles',
    'rational',
    'kernel',
    'kernel-records',
    'kernel-example-data',
    'record-regressions',
  ])
    code = code
      .replaceAll("'../lib/" + moduleName + "'", "'./" + moduleName + ".mjs'")
      .replaceAll("'./" + moduleName + "'", "'./" + moduleName + ".mjs'");
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
const kernelResult = spawnSync(process.execPath, ['work/kernel-test.mjs'], {
  stdio: 'inherit',
});
if (kernelResult.status !== 0) throw Error('Kernel tests failed.');
const result = spawnSync(process.execPath, ['work/integration.mjs'], {
  stdio: 'inherit',
});
if (result.status !== 0)
  throw Error(`Integration test exited with ${result.status}`);
