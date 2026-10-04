/**
 * 把浏览器半打包成 lib/client.js。
 *
 * 产物格式是 DSH 客户端模块表认识的闭包工厂：整个文件调用一次
 * window.__ModuleLoader__.load({ id, factory })，factory 里用注入的
 * require 取平台模块。react、@deepseek-ai/cordis 等由模块表提供
 * （external，不打进产物）；其余依赖全部内联。
 */
import { build } from 'esbuild'

await build({
    entryPoints: ['src/client/index.ts'],
    outfile: 'lib/client.js',
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    sourcemap: true,
    jsx: 'automatic',
    external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-store',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-client-ui-primitives',
        '@deepseek-ai/dsh-client-ui-dockkit',
    ],
    banner: {
        js: 'window.__ModuleLoader__.load({ id: "dsh-note-card", factory: (require) => {\n'
            + 'var module = { exports: {} }; var exports = module.exports;',
    },
    footer: { js: 'return module.exports; } });' },
})
