/**
 * 演示用的五个监听器，一个分发模式一个。
 *
 * 这个插件不派发事件，只监听——派发方在 dsh-event-probe.ts 里。
 * 两边除了事件名（和它带来的 payload 类型）之外互不认识，跟 08 篇的
 * 「消费者只认接口」是同一回事。
 */
import { setTimeout as sleep } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from './events.ts'

export const name = 'dsh-event-lab'

export function apply(ctx: Context): void {
    // 广播：两个监听器都会跑，顺序就是注册顺序，返回值被忽略。
    ctx.on('event-lab/note', (payload) => { payload.trace.push(`note-A(#${payload.run})`) })
    ctx.on('event-lab/note', (payload) => { payload.trace.push(`note-B(#${payload.run})`) })

    // 并发：两个异步监听器一起跑，谁先睡醒谁先写；派发方等最慢的那个。
    ctx.on('event-lab/fanout', async (payload) => {
        await sleep(120)
        payload.trace.push(`fanout-A(#${payload.run}，睡了 120ms)`)
    })
    ctx.on('event-lab/fanout', async (payload) => {
        await sleep(20)
        payload.trace.push(`fanout-B(#${payload.run}，睡了 20ms)`)
    })

    // 顺序：依次 await；B 返回了一个字符串，C 不再执行。
    ctx.on('event-lab/chain', async (payload) => { payload.trace.push(`chain-A(#${payload.run})`) })
    ctx.on('event-lab/chain', (payload) => {
        payload.trace.push(`chain-B(#${payload.run})`)
        return 'chain-B 叫停'
    })
    ctx.on('event-lab/chain', (payload) => { payload.trace.push(`chain-C(#${payload.run})`) })

    // 短路：同步版；A 返回了字符串，B 不再执行。
    ctx.on('event-lab/veto', (payload) => {
        payload.trace.push(`veto-A(#${payload.run})`)
        return 'veto-A 叫停'
    })
    ctx.on('event-lab/veto', (payload) => { payload.trace.push(`veto-B(#${payload.run})`) })

    // 管道：先注册的在最外层，最后兜底的是派发方传进来的那段"内置行为"。
    ctx.on('event-lab/pipe', async (payload, next) => {
        payload.trace.push(`pipe-A 进(#${payload.run})`)
        if (payload.veto) {
            payload.trace.push('pipe-A 没调 next，直接返回')
            return '被 pipe-A 否决'
        }
        const inner = await next()
        payload.trace.push('pipe-A 出')
        return `A(${inner})`
    })
    ctx.on('event-lab/pipe', async (payload, next) => {
        payload.trace.push('pipe-B')
        const builtin = await next()
        return `B(${builtin})`
    })

    // 07 篇说过：ctx.logger 不往终端打，要肉眼可见的证据就自己 console.log。
    console.log(`[${name}] 5 个监听器已就位`)
}
