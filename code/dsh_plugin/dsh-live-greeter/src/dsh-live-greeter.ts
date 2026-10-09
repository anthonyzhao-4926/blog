/**
 * 把 greeter-tool 当作内存插件挂进正在跑的进程，并保证它跟着本插件一起收回。
 *
 * 这是「运行期组合」的最短证明：greeter-tool 不在任何 patch 行里，
 * `--dump-config` 看不到它，但挂上之后它的工具真的进了模型可见的工具表。
 *
 * @module dsh-live-greeter
 */
import type { Context, Fiber } from '@deepseek-ai/cordis'
import * as greeterTool from './greeter-tool.ts'

export const name = 'live-greeter-mount'

// FiberState 的取值顺序（vendor/cordis/src/fiber.ts）。它是 const enum，
// 编译后被内联、运行时不存在这个对象，所以自己留一份名字用来打日志。
const STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

export function apply(ctx: Context): void {
    // 返回的是 fiber，同时是 thenable：不 await 只是「已登记」，
    // await 它才是「已安定」——两者中间夹着 PENDING 这个状态。
    const fiber = ctx.plugin(greeterTool) as Fiber

    console.log(`[${name}] mounted uid=${String(fiber.uid)} state=${STATE_NAMES[fiber.state]}`)

    ctx.effect(() => {
        const off = ctx.on('internal/status', (changed, from) => {
            if (changed !== fiber) return
            // uid 每次重挂都不一样：这是「真的卸掉重挂了」而不是「复用了同一个 fiber」的证据。
            console.log(
                `[${name}] uid=${String(fiber.uid)} ${STATE_NAMES[from]} -> ${STATE_NAMES[changed.state]}`,
            )
        })
        return () => {
            off()
            console.log(`[${name}] unmounting uid=${String(fiber.uid)}`)
        }
    }, 'live-greeter: observe')
}
