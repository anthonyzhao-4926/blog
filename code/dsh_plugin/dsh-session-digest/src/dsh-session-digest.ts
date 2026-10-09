/**
 * 给当前会话记一本「被压缩过几次、被裁剪过几次」的流水账，
 * 再开一个工具让模型能读这本账。
 *
 * 记账用 session-projection：我们只写一个纯函数（apply），订阅 session/event
 * 是框架的事。这叫 host-only 单元——它的 key 只出现在
 * SessionProjectionStateMap 里，不进客户端快照，所以不需要写客户端那一半。
 *
 * @module dsh-session-digest
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
// 只引入类型声明：SessionProjectionStateMap 的增强要合并进这个模块，编译后剥离。
import type {} from '@deepseek-ai/dsh-session-projection/types'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'

export const name = 'dsh-session-digest'

/** sessionProjections 是必需依赖；没有投影注册表本插件不启动。 */
export const inject = ['tools', 'sessionProjections']

const digestSchema = z.object({
    compactions: z.number().int().nonnegative(),
    prunes: z.number().int().nonnegative(),
    lastShadowedTokens: z.number().int().nonnegative(),
})

type DigestState = z.infer<typeof digestSchema>

declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        /** 本会话的压缩 / 裁剪流水账。 */
        sessionDigest: DigestState
    }
}

const zero: DigestState = { compactions: 0, prunes: 0, lastShadowedTokens: 0 }

const definition = {
    key: 'sessionDigest' as const,
    // 折叠语义一变就把版本号加一：旧的持久化行会被丢掉，而不是接着用。
    stateVersion: 1,
    stateSchema: digestSchema,
    init: (): DigestState => zero,
    // 纯函数：不关心的事件必须返回同一个引用，下游才不会白算。
    apply: (state: DigestState, event: SessionEvent): DigestState => {
        if (event.type === 'compaction/end' && event.data.error === undefined) {
            return { ...state, compactions: state.compactions + 1 }
        }
        if (event.type === 'compaction/prune') {
            return {
                ...state,
                prunes: state.prunes + 1,
                lastShadowedTokens: event.data.shadowedTokenCount,
            }
        }
        return state
    },
}

export function apply(ctx: Context): void {
    // 注册本身就是 effect：卸载时这个 key 从快照里消失，不用自己记账。
    ctx.sessionProjections.register(definition)

    ctx.tools.register(defineTool({
        name: 'session_digest',
        description: '报告这个会话被压缩过几次、工具结果被裁剪过几次。',
        parameters: {},
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: (_args, exec) => {
            const session = exec.agent?.session
            if (session === undefined) return 'no agent-bound caller'
            // stateOf 会把该单元当场补算到会话当前游标，所以注册晚于事件也能读到正确值。
            const state = ctx.sessionProjections.stateOf(session, 'sessionDigest')
            return JSON.stringify(state ?? zero)
        },
    }))
}
