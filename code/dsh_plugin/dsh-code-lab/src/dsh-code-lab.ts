/**
 * 让模型跑一小段代码，并把「跑的结果」原样报回来。
 *
 * 这个 demo 想显形的是一处接口约定：**失败是结果里的一个字段，不是抛出来的
 * 异常**。run() 不会被拒绝，它总是正常兑现，然后由调用方去看失败分类，决定
 * 怎么向模型交代。这和「报告程序失败是调用方的职责」是同一件事。
 *
 * 六个失败分类是正交的：预算耗尽不是异常、中止不是超时、基底崩溃（比如 OOM）
 * 又不是这两者中的任何一个。把它们混成一个「失败了」，模型就没法自救——它
 * 需要知道是改代码、还是等一会、还是别写死循环。
 *
 * @module dsh-code-lab
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只引入类型声明：ctx.codeRuntime 的 Context 合并与请求/结果类型。
import type {} from '@deepseek-ai/dsh-code-runtime'

export const name = 'dsh-code-lab'

/** tools 用来注册工具；codeRuntime 是本插件存在的理由。 */
export const inject = ['tools', 'codeRuntime']

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'run_snippet',
        description: '运行一小段 TypeScript 代码并返回它的打印输出与返回值。',
        parameters: {
            type: 'object' as const,
            properties: {
                program: {
                    type: 'string' as const,
                    description: '要运行的代码。可以用顶层 await，用 return 交回一个 JSON 值。',
                },
            },
            required: ['program'],
        },
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: async (args, exec) => {
            const program = (args as { program?: string }).program ?? ''
            if (program === '') return '没有代码要跑。'

            const result = await ctx.codeRuntime.run({
                program,
                // 绑定 = 暴露给这段程序的全局变量，一个命名空间一个全局对象。
                // 只暴露该给的，别把整个 ctx 递进去。
                bindings: [{
                    namespace: 'lab',
                    functions: {
                        now: async () => new Date().toISOString(),
                        upper: async (text: string) => text.toUpperCase(),
                    },
                }],
                signal: exec.signal,
            })

            // 失败是字段，不是异常——所以这里不需要 try/catch。
            if (result.failure !== undefined) {
                // 每个分类都值得原样告诉模型：它据此知道下一步该改什么。
                return `运行失败（${result.failure.kind}）：${result.failure.message}`
            }

            const printed = result.logs.map((line) => line.text).join('\n')
            return JSON.stringify({
                打印输出: printed,
                返回值: result.value ?? null,
                // 基底与语言是服务上的只读描述符，报出来便于排查「为什么这段跑不了」。
                语言: ctx.codeRuntime.language,
                执行基底: ctx.codeRuntime.isolation,
            }, null, 2)
        },
    }))
}
