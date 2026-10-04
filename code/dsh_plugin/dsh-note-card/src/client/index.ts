/**
 * 浏览器半：把 note_search 的工具结果渲染成卡片。
 *
 * 挂的是 keyed slot `tool.call.toolview`：ui-tool 渲染每一次工具调用时，按
 * 工具的 wire 名字分发到这个 slot。key 写 'note_search' 就只接管
 * note_search 的卡片，别的工具照旧走通用卡片。
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：ctx.sessions 与 tool.call.toolview 的 SlotMap 增强，
// 编译后剥离，运行时由 DSH 的模块表提供实现。
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { NoteSearchCard, type NoteSearchCardInjected } from './NoteSearchCard.tsx'

export const inject = ['slots', 'sessions']

export function apply(ctx: Context): void {
    // ctx.slots.inject 等 ui-tool 把 tool.call.toolview 声明出来再执行回调；
    // 它卸载时这次注册跟着撤（14 篇讲过的声明生命周期）。
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key: 'note_search',
        // session 作用域的 inject 工厂会收到当前 sessionId。送回会话的通道
        // 在这里闭包进组件 props——组件本身永远碰不到 ctx。
        inject: (sessionId): NoteSearchCardInjected => ({
            sendPrompt: (text, mode) => {
                void ctx.sessions.binding(sessionId)?.session.prompt([{ type: 'text', text }], mode)
            },
        }),
    }, NoteSearchCard))
}
