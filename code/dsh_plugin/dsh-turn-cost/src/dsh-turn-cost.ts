/**
 * 报一本「这一趟花了多少」的账：内置的用量 / 时长 / 压力单元，加自己折的失败计数。
 *
 * 读内置单元用 ctx.sessionProjections.stateOf()；失败次数内置没有，
 * 得自己注册一个 host-only 单元来折。
 *
 * @module dsh-turn-cost
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
// 这几行不是废行：它们把对应包对 SessionProjectionStateMap 的类型声明合并进
// 本程序，去掉就编译不过（下面 stateOf 的三个 key 认不出来）。
import type {} from '@deepseek-ai/dsh-session-projection/types'
import type {} from '@deepseek-ai/dsh-session-stats'
import type {} from '@deepseek-ai/dsh-token-meter'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'

export const name = 'dsh-turn-cost'

/** sessionProjections 是必需依赖；没有投影注册表本插件不启动。 */
export const inject = ['tools', 'sessionProjections']

const failuresSchema = z.object({
    toolErrors: z.number().int().nonnegative(),
    turnErrors: z.number().int().nonnegative(),
    providerRetries: z.number().int().nonnegative(),
})

type FailuresState = z.infer<typeof failuresSchema>

declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        /** 本会话的失败次数。内置没有这个单元，所以自己折。 */
        failureCounts: FailuresState
    }
}

const zero: FailuresState = { toolErrors: 0, turnErrors: 0, providerRetries: 0 }

const failureCounts = {
    key: 'failureCounts' as const,
    stateVersion: 1,
    stateSchema: failuresSchema,
    init: (): FailuresState => zero,
    // 纯函数：不关心的事件必须返回同一个引用。
    apply: (state: FailuresState, event: SessionEvent): FailuresState => {
        if (event.type === 'tool/result' && event.data.message.content[0]?.isError === true) {
            return { ...state, toolErrors: state.toolErrors + 1 }
        }
        if (event.type === 'turn/end' && event.data.reason.kind === 'error') {
            return { ...state, turnErrors: state.turnErrors + 1 }
        }
        if (event.type === 'llm/retry') {
            return { ...state, providerRetries: state.providerRetries + 1 }
        }
        return state
    },
}

export function apply(ctx: Context): void {
    ctx.sessionProjections.register(failureCounts)

    ctx.tools.register(defineTool({
        name: 'turn_cost',
        description: '报告这个会话的用量、墙钟时长、步数和失败次数。',
        parameters: {},
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: (_args, exec) => {
            const session = exec.agent?.session
            if (session === undefined) return 'no agent-bound caller'
            const read = (key: 'tokenUsage' | 'sessionStats' | 'contextPressure' | 'failureCounts') =>
                ctx.sessionProjections.stateOf(session, key)
            return JSON.stringify({
                usage: read('tokenUsage'),
                time: read('sessionStats'),
                pressure: read('contextPressure'),
                failures: read('failureCounts') ?? zero,
            }, null, 2)
        },
    }))
}
