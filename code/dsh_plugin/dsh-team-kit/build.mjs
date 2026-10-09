/**
 * 把 src/ 转译到 lib/。
 *
 * 这一步是给"从 git 安装"准备的：pnpm 拉 git 依赖时拿到的是源码，不会有任何
 * 环节替你跑 build，所以包必须自带 `prepare` 脚本（pnpm 在 git 安装后会跑它），
 * 而且要自包含——不能假设旁边有一份 monorepo checkout。
 *
 * 依赖保持 external：安装时由 profile 的 node_modules 解析，不打进产物。
 */
import { build } from 'esbuild'

await build({
    entryPoints: ['src/index.ts'],
    outdir: 'lib',
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: false,
})
