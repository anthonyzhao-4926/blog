/**
 * 危险 bash 调用先问人：`tools/pre-execute` 返回 `{ kind: 'ask' }`，
 * 剩下的路由、判定、审计全部交给 `ctx.approval`。
 *
 * 审计对（approval/asked + approval/decided）是 log-only 的会话事件，
 * 不进模型对话，这里只是顺手把它们打印出来，方便对着日志讲。
 *
 * @module dsh-ask-before-bash
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：approval/* 事件与 session/event 的类型由这两个包合并进来。
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-user-approval'

export const name = 'dsh-ask-before-bash'

/** 要工具管线；审批服务是可选依赖，用 ctx.get 机会式获取。 */
export const inject = ['tools']

/** 需要人拍板的命令模式，理由写给用户也写给模型。 */
const NEEDS_APPROVAL: readonly { pattern: RegExp; reason: string }[] = [
    { pattern: /\bgit\s+push\b/, reason: '这条命令会推送到远端仓库，请确认目标和分支。' },
    { pattern: /\b(rm|mv)\s+-[a-zA-Z]*r/, reason: '递归删除或移动，确认路径无误再继续。' },
    { pattern: /\b(npm|pnpm|yarn)\s+publish\b/, reason: '这会发布一个包，发出去就撤不回。' },
]

export function apply(ctx: Context): void {
    // 返回 { kind: 'ask' } 只表示「这事要问人」；谁来问、怎么问是审批服务的事。
    // 没有审批服务时工具侧会降级为拒绝，不会因为没人接管就放行。
    ctx.on('tools/pre-execute', async (exec, next) => {
        if (exec.name !== 'bash') return next()
        const command = (exec.arguments as { command?: unknown }).command
        if (typeof command !== 'string') return next()
        const hit = NEEDS_APPROVAL.find(entry => entry.pattern.test(command))
        return hit === undefined ? next() : { kind: 'ask', reason: hit.reason }
    })

    // 问与答各落一条事件，用同一个 id 配对；会话日志里能查到完整审计。
    ctx.on('session/event', (session, event) => {
        if (event.type === 'approval/asked') {
            console.log(`[${name}] 问：${String(event.data.toolName)}（${String(event.data.reason ?? '无理由')}）`)
        }
        if (event.type === 'approval/decided') {
            console.log(`[${name}] 答：${String(event.data.outcome)}`)
        }
    })
}
