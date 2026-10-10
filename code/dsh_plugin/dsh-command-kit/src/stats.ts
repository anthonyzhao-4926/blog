/**
 * `/kit-stats`：一条不碰模型、只看日志的查询命令。
 *
 * 命令、反馈、交付物这三类东西都有一个共同点：它们**只写进会话日志、不进模型上下文**。
 * 所以想要一个服务面，只能自己折。这个插件在 `session/event` 上折四个计数，
 * 再用一条命令把它读出来——顺带证明命令的结果也不需要模型参与。
 *
 * @module dsh-command-kit/stats
 */
import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'

/** Cordis 插件名 */
export const name = 'command-kit-stats'

/** 命令注册表是必需的。 */
export const inject = ['commands']

/** 一个会话的四个计数。 */
interface Counts {
    /** 敲过几次命令（`command/run`）。 */
    commands: number
    /** 其中几次以 error 收场（`command/done` 的 kind）。 */
    commandErrors: number
    /** 记录过几条会话级反馈（`feedback/record`）。 */
    feedback: number
    /** 模型声明过几次交付物（`deliverables/presented`）。 */
    deliveries: number
}

/**
 * 空计数。每次返回新对象，免得共享可变字面量。
 *
 * @returns 四个字段全为 0 的计数。
 */
function emptyCounts(): Counts {
    return { commands: 0, commandErrors: 0, feedback: 0, deliveries: 0 }
}

/**
 * 注册 `/kit-stats` 并开始折计数。
 *
 * @param ctx - 插件上下文。
 */
export function apply(ctx: Context): void {
    const bySession = new Map<string, Counts>()

    const countsFor = (sessionId: string): Counts => {
        const existing = bySession.get(sessionId)
        if (existing !== undefined) return existing
        const created = emptyCounts()
        bySession.set(sessionId, created)
        return created
    }

    // 这三个事件都是 log-only 的：它们落进会话日志，但从不进入模型请求。
    ctx.on('session/event', (session, event) => {
        const counts = countsFor(session.id)
        if (event.type === 'command/run') counts.commands += 1
        else if (event.type === 'command/done' && event.data.kind === 'error') counts.commandErrors += 1
        else if (event.type === 'feedback/record') counts.feedback += 1
        else if (event.type === 'deliverables/presented') counts.deliveries += 1
    })

    ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-command-kit/stats'),
        name: 'kit-stats',
        description: "Show this session's command / feedback / delivery counts",
        recordInput: false,
        handler: ({ agent }) => {
            const counts = bySession.get(agent.session.id) ?? emptyCounts()
            return {
                kind: 'success',
                text: `命令 ${counts.commands}（其中失败 ${counts.commandErrors}）`
                    + ` · 反馈 ${counts.feedback} · 交付 ${counts.deliveries}`,
            }
        },
    })

    console.log(`[${name}] 已注册 /kit-stats`)
}
