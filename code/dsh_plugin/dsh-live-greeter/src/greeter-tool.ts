/**
 * 被运行期挂上去的内存插件：注册一个打招呼的工具。
 *
 * 它不在任何 patch 行里，也不 import 宿主的内部模块，只通过 `ctx` 拿能力。
 * 这是能被动态挂的前提：插件只能依赖「全局服务存储里有什么」，不能依赖
 * 「它在配置树的哪个位置」——内存插件根本没有位置。
 *
 * @module dsh-live-greeter/greeter-tool
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'live-greeter'

/** 要工具注册表。没有它，这个 fiber 会停在 PENDING——而且不报错。 */
export const inject = ['tools']

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'live_greet',
        description: '跟一个人打招呼。由 dsh-live-greeter 在运行期挂上。',
        parameters: {
            whom: { type: 'string', required: true, description: '要打招呼的人。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    whom: { type: 'string', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: `你好，${value.whom}。` }],
        },
        execute(args) {
            return Promise.resolve({ whom: args.whom })
        },
    }))
}
