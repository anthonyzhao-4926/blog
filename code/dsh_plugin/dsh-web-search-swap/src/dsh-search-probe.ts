/**
 * 一个最小的消费者：把 `ctx.web.search()` 接到一条 HTTP 路由上。
 *
 * 真正的消费者是 `dsh-tool-web`（模型的 `web_search` 工具）。它认的也只是
 * `ctx.web` 这一个名字，跟 provider 是谁没有关系。这个探针插件把同一件事
 * 接到路由上，好让 curl 就能看见"这次换源到底生效没有"，不用每次都去问模型。
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引类型声明（module augmentation），编译后剥离，运行时零开销。
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-search-probe'

/** 消费者的依赖就是这两个服务名，没有任何 provider 的名字。 */
export const inject = ['web', 'webServer']

const PATH = '/dsh-search-probe/search'

export function apply(ctx: Context): void {
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: PATH,
        handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://127.0.0.1')
            const query = url.searchParams.get('q') ?? ''
            const limit = url.searchParams.get('limit')
            const payload = await run(ctx, query, limit)
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(payload, null, 2))
        },
    }))
}

/** 调用 seam；选择失败时把结构化错误码原样打出来，省得猜。 */
async function run(ctx: Context, query: string, limit: string | null) {
    try {
        return await ctx.web.search(limit === null ? { query } : { query, maxResults: Number(limit) })
    } catch (error) {
        return {
            error: (error as { code?: string }).code ?? 'UNKNOWN',
            message: (error as Error).message,
        }
    }
}
