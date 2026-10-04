// 07 篇「改代码不想重启」的演示插件。
//
// 两处可改的地方，各代表一类热重载：
//   改下面的 VERSION         → 源码热重载（要先把 hmr 那行的 root 指到这个目录）
//   改 patch 里的 config.tag → 配置热重载（默认就开着）
//
// 这个插件不导出 Config，所以 patch 里的 config 原样传给 apply（见 06 篇：
// 想让 Cordis 校验就用 schema，不想校验就不导，两种都合法）。

export const name = 'dsh-hmr-demo'

const VERSION = 'src-v1'

export function apply(ctx, config = {}) {
    const tag = config.tag ?? 'patched-v0'

    console.log(`[dsh-hmr-demo] apply() 执行：tag=${tag}，VERSION=${VERSION}`)

    // 热重载会卸载旧 fiber（05 篇），所以注册必须能被撤掉：
    // 少了这层 ctx.effect，重载时第二次 register 会撞 duplicate route。
    ctx.inject(['webServer'], (serverCtx) => {
        ctx.effect(() => serverCtx.webServer.register({
            kind: 'exact',
            path: '/dsh-hmr-demo/ping',
            handler: (_req, res) => {
                res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
                res.end(`dsh-hmr-demo: tag=${tag}, VERSION=${VERSION}\n`)
            },
        }))
    })
}
