// 把 TS 转译到 lib/：npm 版 dsh 加载的是 JS，不是 TS。
// bundle 保持 false——依赖由 profile 的 node_modules 提供，不要打进来。
import { build } from 'esbuild'

await build({
    entryPoints: ['src/index.ts', 'src/invariant.ts'],
    outdir: 'lib',
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
})
