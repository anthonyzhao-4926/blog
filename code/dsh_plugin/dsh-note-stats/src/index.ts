/**
 * dsh-note-stats 的 Host 半：订阅 note_search 的工具调用事件做统计，
 * 数一遍笔记目录，把结果挂在 /api 下的一条 Fetch 路由上。
 *
 * 统计手法与 09 篇相同（广播事件 tools/result，结果定型后只观察）；
 * 路由不是 04 篇的 webServer.register，而是 Connection 的 exact Fetch 路由——
 * 它在 /api 下面，到达 handler 之前已经过了 Host/Origin 检查和浏览器会话认证。
 */
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// 只引入类型声明（模块增强）：ctx.connection 服务与 tools/result 事件的类型
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'dsh-note-stats'

export interface Config {
    /** 笔记目录的绝对路径（与 10 篇 dsh-note-search 的 root 看同一个地方）。 */
    root: string
}

export const Config: Schema<Config> = Schema.object({
    root: Schema.string().default(join(homedir(), 'notes')),
})

/** 一次 note_search 调用留下的记录。 */
interface SearchRecord {
    readonly query: string
    readonly at: number
    readonly ok: boolean
}

/** 最近记录保留的条数上限。 */
const RECENT_LIMIT = 10

export function apply(ctx: Context, config: Config): void {
    let calls = 0
    let failures = 0
    const recent: SearchRecord[] = []

    // 广播：结果已定型的时机，只记账（手法见 09 篇）。exec.arguments 是这次调用的参数。
    ctx.on('tools/result', (exec, result) => {
        if (exec.name !== 'note_search') return
        const args = (exec.arguments ?? {}) as { query?: unknown }
        calls += 1
        if (result.isError) failures += 1
        if (typeof args.query === 'string') {
            recent.unshift({ query: args.query, at: Date.now(), ok: !result.isError })
            if (recent.length > RECENT_LIMIT) recent.pop()
        }
    })

    /** 路由每次请求时现取的完整快照。 */
    const snapshot = async () => ({
        root: config.root,
        notes: await countMarkdown(config.root),
        searches: { calls, failures, recent },
    })

    // 统计本身不依赖 HTTP：只有挂路由这段等 connection 服务（09 篇等 webServer 的同款写法）。
    ctx.inject(['connection'], (connCtx) => {
        // register 内部已把注销绑进调用方的 effect——插件卸载，路由跟着消失，
        // 不用再像 04 篇的 webServer.register 那样自己包一层 ctx.effect。
        connCtx.connection.fetch.register({
            path: '/api/dsh-note-stats/stats',
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => new Response(JSON.stringify(await snapshot()), {
                headers: { 'content-type': 'application/json; charset=utf-8' },
            }),
        })
    })

    console.log(`[${name}] 统计已就位，路由 /api/dsh-note-stats/stats`)
}

/** 递归数 root 下的 .md 文件；目录不存在就当 0。 */
async function countMarkdown(root: string): Promise<number> {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    let total = 0
    for (const entry of entries) {
        if (entry.isDirectory()) total += await countMarkdown(join(root, entry.name))
        else if (entry.name.endsWith('.md')) total += 1
    }
    return total
}
