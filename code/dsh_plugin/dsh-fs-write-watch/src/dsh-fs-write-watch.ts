/**
 * 文件边界观察器：把「这次写能不能落盘」的事实摊给用户看——
 * 沙箱模式与可写根（能/不能）、每个文件是否被读过（观察策略）。
 *
 * 只读不改：不注册任何拦截器，不抢 fs/* 的单槽决策。
 *
 * @module dsh-fs-write-watch
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只引入类型声明：fs/observed、session/event、ctx.sandboxPolicy 的类型由这些
// 包合并进来，编译后剥离，运行时实现由 DSH 的模块表提供。
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'

export const name = 'dsh-fs-write-watch'

/** 要工具注册表和沙箱策略服务；缺一个本插件就不启动。 */
export const inject = ['tools', 'sandboxPolicy']

/** 每个会话观察到的文件：displayPath → `v:<版本>` 或 `absent`。 */
const observed = new WeakMap<object, Map<string, string>>()

/** fs 事件的 actor 上挂着发起这次读写的 agent 会话；没有 agent 时是 undefined。 */
function sessionOf(actor: unknown): object | undefined {
    const agent = (actor as { agent?: { session?: object } } | undefined)?.agent
    return agent?.session
}

export function apply(ctx: Context): void {
    // fs/observed 是记录型事件：必须同步、不许抛，所以这里只做一次 Map.set。
    ctx.on('fs/observed', (target, observation, actor) => {
        const session = sessionOf(actor)
        if (session === undefined) return
        const byPath = observed.get(session) ?? new Map<string, string>()
        const mark = observation.kind === 'present' ? `v:${observation.version}` : 'absent'
        byPath.set(target.displayPath, mark)
        observed.set(session, byPath)
    })

    // sandbox/mode 是 log-only 事件：切模式只往会话日志里追加一条，重放即恢复。
    ctx.on('session/event', (session, event) => {
        if (event.type !== 'sandbox/mode') return
        console.log(`[${name}] ${session.id} 文件效果模式 -> ${String(event.data.mode)}`)
    })

    ctx.tools.register(defineTool({
        name: 'policy_report',
        description: '报告当前会话的文件边界：沙箱模式、可写根、已观察文件数。',
        // 无参数工具：parameters 也要给一个空映射。
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    mode: { type: 'string', required: true },
                    workspaceRoot: { type: 'string', required: true },
                    observedFiles: { type: 'integer', required: true },
                },
            },
            render: (_args, value) => [{
                type: 'text',
                text: `模式 ${value.mode}；可写根 ${value.workspaceRoot}；已观察 ${value.observedFiles} 个文件`,
            }],
        },
        execute(_args, exec) {
            // 有效模式 = 已批准的显式升级 > 会话日志里最后一条 sandbox/mode > 部署默认。
            const session = exec.agent?.session
            const policy = ctx.sandboxPolicy.resolve(session === undefined ? {} : { session })
            const files = session === undefined ? undefined : observed.get(session)
            return {
                mode: policy.mode,
                workspaceRoot: policy.workspaceRoot,
                observedFiles: files?.size ?? 0,
            }
        },
    }))
}
