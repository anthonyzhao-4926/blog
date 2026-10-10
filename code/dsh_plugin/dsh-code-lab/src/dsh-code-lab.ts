/**
 * 让模型跑一小段代码，并把「跑的结果」原样报回来。
 *
 * 这个 demo 想显形的是两处接口约定：
 *
 * 1. **请求与规格是两步**。调用方给服务一份 PtcRunRequest，resolve() 校验支持
 *    的选择、套上部署默认值与上限，交回一份 cwd 与 timeoutMs 都不缺的
 *    PtcRunSpec；run() 只执行规格，不会替你补缺失的目录或截止时间。
 * 2. **失败是结果里的一个字段，不是抛出来的异常**。run() 不会被拒绝，它总是
 *    正常兑现，然后由调用方去看失败分类，决定怎么向模型交代。这和「报告程序
 *    失败是调用方的职责」是同一件事。
 *
 * 八个失败分类是正交的：预算耗尽不是异常、中止不是超时、基底崩溃（比如 OOM）
 * 又不是这两者中的任何一个。把它们混成一个「失败了」，模型就没法自救——它
 * 需要知道是改代码、还是缩短任务、还是别打印那么多。
 *
 * @module dsh-code-lab
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只引入类型声明：ctx.ptcRuntime 的 Context 合并，以及请求与结果类型。
import type {} from '@deepseek-ai/dsh-ptc-runtime'

export const name = 'dsh-code-lab'

/** tools 用来注册工具；ptcRuntime 是本插件存在的理由。 */
export const inject = ['tools', 'ptcRuntime']

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'run_snippet',
        description: '运行一小段 TypeScript 代码并返回它的日志与返回值。',
        parameters: {
            // parameters 是一张「参数名 → 属性」的平表：根对象是隐式的，
            // required 写在每个属性上，不是外面的一个 required 数组。
            program: {
                type: 'string',
                required: true,
                description: '要运行的代码。可以用顶层 await，用 return 交回一个 JSON 值。',
            },
            timeoutMs: {
                type: 'number',
                description: '这次运行的经过时间预算（毫秒）。省略用提供方默认值；给了会被截到部署上限。',
            },
        },
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: async (args, exec) => {
            const { program, timeoutMs } = args as { program?: string, timeoutMs?: number }
            if (program === undefined || program === '') return '没有代码要跑。'

            // 请求进，规格出：resolve 校验支持的选择、套上部署默认值与上限。
            const spec = ctx.ptcRuntime.resolve({
                program,
                // 绑定 = 暴露给这段程序的全局变量，一个命名空间一个全局对象。
                // 只暴露该给的，别把整个 ctx 递进去。
                bindings: [{
                    global: 'lab',
                    functions: {
                        now: async () => new Date().toISOString(),
                        // 绑定函数只收一个参数：程序那边写成 lab.upper({ text: 'x' })。
                        upper: async (args: unknown) => {
                            const text = (args as { text?: unknown }).text
                            return typeof text === 'string' ? text.toUpperCase() : ''
                        },
                    },
                }],
                // 省略 timeoutMs 用提供方默认值；给了数值会被截到部署上限。
                ...timeoutMs === undefined ? {} : { timeoutMs },
                signal: exec.signal,
            })

            // run 拿的是规格，不是请求：目录与截止时间在规格里已经明确。
            const result = await ctx.ptcRuntime.run(spec)

            // 失败是字段，不是异常——所以这里不需要 try/catch。
            if (result.error !== undefined) {
                // 每个分类都值得原样告诉模型：它据此知道下一步该改什么。
                return `运行失败（${result.error.kind}）：${result.error.message}`
            }

            return JSON.stringify({
                打印输出: result.logs.join('\n'),
                返回值: result.value ?? null,
                // 基底与语言是服务上的只读描述符，报出来便于排查「为什么这段跑不了」。
                语言: ctx.ptcRuntime.language,
                执行基底: ctx.ptcRuntime.isolation,
            }, null, 2)
        },
    }))
}
