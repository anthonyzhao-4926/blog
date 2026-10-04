/**
 * 一扇窗：用 curl 派发一次自己声明的事件，把监听器的轨迹原样回传。
 *
 * 五种分发模式各派发一个事件，好让"广播 / 并发 / 顺序 / 短路 / 管道"
 * 的差别在一次 curl 里看得见——真实插件不会为了看这个而发事件，这是
 * 演示与排查用的探针。08 篇的探针也是这个角色。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LabEvent } from './events.ts'
import type {} from './events.ts'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-event-probe'

export const inject = ['webServer']

const PATH = '/dsh-event-lab/fire'

export function apply(ctx: Context): void {
    let run = 0
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: PATH,
        handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://127.0.0.1')
            const mode = url.searchParams.get('mode') ?? 'emit'
            const payload: LabEvent = {
                run: ++run,
                veto: url.searchParams.get('veto') === '1',
                trace: [],
            }
            const startedAt = Date.now()
            const returned = await fire(ctx, mode, payload)
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({
                mode,
                returned,
                elapsedMs: Date.now() - startedAt,
                trace: payload.trace,
            }, null, 2))
        },
    }))
}

/** 按模式派发。`waterfall` 多传一个参数：链条最内层的"内置行为"。 */
async function fire(ctx: Context, mode: string, payload: LabEvent): Promise<unknown> {
    switch (mode) {
        case 'emit':
            ctx.emit('event-lab/note', payload)
            return null
        case 'parallel':
            await ctx.parallel('event-lab/fanout', payload)
            return null
        case 'serial':
            return await ctx.serial('event-lab/chain', payload) ?? null
        case 'bail':
            return ctx.bail('event-lab/veto', payload) ?? null
        case 'waterfall':
            return await ctx.waterfall('event-lab/pipe', payload, async () => '内置行为')
        default:
            return `未知模式：${mode}`
    }
}
