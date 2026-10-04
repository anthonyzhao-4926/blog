/**
 * 统计真实发生在 DSH 里的事件，并把计数挂到一条 HTTP 路由上。
 *
 * 它监听三件不同的事：
 *   - `tools/execute`（管道）：包住一次工具执行，量它花了多久；
 *   - `tools/result`（广播）：一次调用结束，记成功/失败；
 *   - `session/event`（广播）：每有一条会话记录落日志就响一次。
 *
 * 三种用法各自对应一种分发模式的选择理由，正文里逐个说。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-approval'

export const name = 'dsh-event-stats'

// 故意不写模块级 inject：统计这件事本身不依赖任何服务，headless 里也要跑。
// 只有"把计数挂到路由上"这一段需要 webServer，所以用 04 篇的写法单独等它。
const PATH = '/dsh-event-log/stats'

interface ToolStat {
    calls: number
    failures: number
    totalMs: number
}

export function apply(ctx: Context): void {
    const tools = new Map<string, ToolStat>()
    /** 会话记录（写进 JSONL 的那些）按类型计数。 */
    const recorded = new Map<string, number>()
    /** 审批结果按 outcome 计数。 */
    const approvals = new Map<string, number>()
    /** callId → 本次调用耗时，由上面的管道写、下面的广播取。 */
    const durations = new Map<string, number>()
    let sessions = 0

    // 管道：包住一次执行量时长。next() 的结果要原样返回（换个值就是替换
    // 这次调用的结果），也不能不调 next()——那等于不让这次调用真的执行。
    ctx.on('tools/execute', async (exec, next) => {
        const startedAt = Date.now()
        try {
            return await next()
        } finally {
            durations.set(exec.callId, Date.now() - startedAt)
        }
    })

    // 广播：此刻结果已经定型，监听器只观察、不改写。
    ctx.on('tools/result', (exec, result) => {
        const ms = durations.get(exec.callId)
        durations.delete(exec.callId)
        const stat = tools.get(exec.name) ?? { calls: 0, failures: 0, totalMs: 0 }
        stat.calls += 1
        if (result.isError) stat.failures += 1
        stat.totalMs += ms ?? 0
        tools.set(exec.name, stat)
        console.log(`[${name}] ${exec.name} ${result.isError ? '失败' : '成功'}${ms === undefined ? '' : ` ${ms}ms`}`)
    })

    /** 当前的计数快照：路由用它，一轮结束时的那行日志也用它。 */
    const snapshot = () => ({
        sessions,
        tools: Object.fromEntries([...tools].map(([toolName, stat]) => [toolName, {
            ...stat,
            avgMs: Math.round(stat.totalMs / stat.calls),
        }])),
        approvals: sorted(approvals),
        recorded: sorted(recorded),
    })

    // 广播：会话记录落一条响一次。`event.type` 就是记录类型，`event.data` 是它的内容。
    ctx.on('session/event', (_session, event) => {
        bump(recorded, event.type)
        if (event.type === 'approval/decided') {
            bump(approvals, event.data.outcome)
        }
        // 一轮结束是个天然的结算点：headless 里没有路由可 curl，这行就是全部证据。
        if (event.type === 'turn/end') {
            console.log(`[${name}] 一轮结束：${JSON.stringify(snapshot())}`)
        }
    })

    ctx.on('session/created', () => { sessions += 1 })

    ctx.inject(['webServer'], (serverCtx) => {
        serverCtx.effect(() => serverCtx.webServer.register({
            kind: 'exact',
            path: PATH,
            handler: (_req, res) => {
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
                res.end(JSON.stringify(snapshot(), null, 2))
            },
        }))
    })
}

function bump(counter: Map<string, number>, key: string): void {
    counter.set(key, (counter.get(key) ?? 0) + 1)
}

/** 次数多的在前；一样多就按名字。 */
function sorted(counter: Map<string, number>): Record<string, number> {
    return Object.fromEntries([...counter].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])))
}
