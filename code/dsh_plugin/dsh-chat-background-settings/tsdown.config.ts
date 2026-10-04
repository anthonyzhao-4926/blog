/**
 * 浏览器半的构建配置。
 *
 * DSH 仓库内用 packages/client/tsdown.client.ts 的 clientBundle 预设产出
 * 客户端包，但这个预设不随 npm 发布，仓库外的包要自己复现它的输出契约：
 * 一个 CJS 浏览器包，首尾把代码包进
 *   window.__ModuleLoader__.load({ id: <包名>, factory: (require) => { ... } })
 * 页面里的模块表按 id 登记 factory，插件被激活时调用它。
 *
 * react 与 @deepseek-ai/cordis 保持外部引用：页面里的模块表已备好这两个
 * 模块（平台基线），factory 收到的 require 能直接答它们；其余依赖一律打包
 * 进产物——模块表答不上的 require 会在运行时直接抛错。
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    deps: {
        neverBundle: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis'],
    },
    outputOptions: {
        // 产物名固定为 lib/client.js：/plugins 路由的组合地址按 <包名>/client.js 拼。
        entryFileNames: 'client.js',
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        banner: `window.__ModuleLoader__.load({ id: 'dsh-chat-background-settings', factory: (require) => {`,
        footer: 'return module.exports; } });',
    },
})
