/**
 * 浏览器半的构建配置。
 *
 * DSH 仓库内用 packages/client/tsdown.client.ts 的 clientBundle 预设产出
 * 客户端包，但这个预设不随 npm 发布，仓库外的包要自己复现它的输出契约：
 * 一个 CJS 浏览器包，首尾把代码包进
 *   window.__ModuleLoader__.load({ id: <包名>, factory: (require) => { ... } })
 * 页面里的模块表按 id 登记 factory，插件被激活时调用它。
 *
 * neverBundle 列的就是页面的平台基线模块（packages/client/web/src/platform.ts
 * 里那份 PLATFORM_MODULES 清单）：factory 收到的 require 能直接答它们，所以
 * 一律保持外部引用。基线之外的依赖全部打包进产物——模块表答不上的 require
 * 会在运行时直接抛错。
 *
 * react 那几条最硬：页面里多一份 React，hooks 与 context 立刻不工作。其余几条
 * 是把页面已经共享给所有插件的那份实现再打一份进去，不会当场报错，但版本会
 * 各自漂移。按清单整体处理，不要逐个判断该不该外部化。
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
        neverBundle: [
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
    },
    outputOptions: {
        // 产物名固定为 lib/client.js：/plugins 路由的组合地址按 <包名>/client.js 拼。
        entryFileNames: 'client.js',
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        banner: `window.__ModuleLoader__.load({ id: 'dsh-chat-background-settings', factory: (require) => {`,
        footer: 'return module.exports; } });',
    },
})
