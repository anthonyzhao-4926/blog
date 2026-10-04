/**
 * 我们自己声明的五个事件。
 *
 * 一个事件名只属于一种分发模式，所以五个模式各有自己的名字——这不是为了
 * 演示而拆的，harness 里的事件就是这么定的（`tools/result` 永远是广播，
 * `agent/pre-step` 永远是管道）。
 *
 * `declare module '@deepseek-ai/cordis'` 是类型层面的登记：Cordis 把所有
 * 插件声明的事件合并成一张总表，`ctx.emit` / `ctx.on` 的名字与参数才有类型。
 */
import type {} from '@deepseek-ai/cordis'

/** 一次实验带上的编号，以及监听器往里写话的轨迹数组。 */
export interface LabEvent {
    /** 本次实验的编号，探针每次请求自增。 */
    readonly run: number
    /** 令 `pipe` 的最外层监听器不调 `next()`，用来演示短路。 */
    readonly veto: boolean
    /** 监听器把"我跑了"写进这里；派发方读它，一次请求的结果就齐了。 */
    readonly trace: string[]
}

declare module '@deepseek-ai/cordis' {
    interface Events {
        /** 广播：每个监听器都跑一遍，返回值没人看。 */
        'event-lab/note'(payload: LabEvent): void
        /** 并发：每个监听器都跑一遍，派发方等最慢的那个。 */
        'event-lab/fanout'(payload: LabEvent): Promise<void>
        /** 顺序：依次 await，某个监听器返回非空值就停下。 */
        'event-lab/chain'(payload: LabEvent): string | void | Promise<string | void>
        /** 短路：同步依次调用，某个监听器返回非空值就停下。 */
        'event-lab/veto'(payload: LabEvent): string | void
        /** 管道：监听器包住 `next()`，不调 `next()` 就否决后面的监听器与内置行为。 */
        'event-lab/pipe'(payload: LabEvent, next: () => Promise<string>): Promise<string>
    }
}
