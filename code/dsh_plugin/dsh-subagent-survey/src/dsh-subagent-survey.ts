/**
 * 侦察当前进程里有哪些子 agent 提供方、各自支持什么。
 *
 * 为什么值得单独做个工具：subagent 服务的「能力」不是运行时试探出来的，
 * 而是在请求之前就按提供方的静态描述符校验的——请求依赖了一个提供方不具备
 * 的能力，会被明确拒绝（UNSUPPORTED_CAPABILITY），绝不会「先接受再静默忽略」。
 * 所以动手委派之前，先看清手上这几个提供方各自能接什么活。
 *
 * 两类能力用的是两种发现方式，这个工具把两种都列出来：
 * - 启动时能力：读提供方的 capabilities 描述符。
 * - 可继续子 agent：不看 flag，看 prepareContinuable 这个方法在不在——
 *   方法存在即能力。
 *
 * @module dsh-subagent-survey
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：ctx.subagents 的 Context 合并。
import type {} from '@deepseek-ai/dsh-subagent'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-subagent-survey'

/** tools 用来注册工具；subagents 是本插件存在的理由，缺一不可。 */
export const inject = ['tools', 'subagents']

/** 一个提供方的能力报告。 */
function describeProvider(ctx: Context, name: string): string {
    const provider = ctx.subagents.getProvider(name)
    // list() 与 getProvider() 之间可以被别的 fiber 摘掉，所以这里要兜住。
    if (provider === undefined) return `${name}: 刚刚被移除`

    // capabilities 是五个布尔 flag，一一对应启动请求里的可选项。
    const supported = Object.entries(provider.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([capability]) => capability)

    return [
        name,
        `  启动时能力：${supported.length === 0 ? '（一个都不支持）' : supported.join(', ')}`,
        `  继承父对话前缀：${provider.inheritsParentContext ? '是' : '否'}`,
        `  可继续子 agent：${provider.prepareContinuable === undefined ? '不支持' : '支持'}`,
    ].join('\n')
}

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'subagent_survey',
        description: '列出当前所有子 agent 提供方，以及每个提供方支持的启动时能力。',
        parameters: {},
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: () => {
            const names = ctx.subagents.list()
            if (names.length === 0) return '当前没有任何子 agent 提供方。'
            return names.map((name) => describeProvider(ctx, name)).join('\n\n')
        },
    }))
}
