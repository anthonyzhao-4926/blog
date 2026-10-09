/**
 * 把一批互不依赖的小任务并发派给子 agent，各自跑完再汇总。
 *
 * 编排这件事交给 workflow：我们只交一段脚本文本、一个身份块和一份入参，
 * 引擎负责解析、在它自己的工作线程里执行、并管理脚本里启动的每个子 agent。
 * 脚本里的 parallel() 是「逐项隔离」的那个组合器：其中一项失败只会让那一项
 * 变成 null，不会拖累别人；而脚本写错了参数这类「钩子误用」是 fatal，
 * 会当场终止整段脚本——两种失败刻意不混淆。
 *
 * @module dsh-workflow-lite
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只引入类型声明：ctx.workflowEngine 的 Context 合并。
import type {} from '@deepseek-ai/dsh-workflow'

export const name = 'dsh-workflow-lite'

/** tools 用来注册工具；workflowEngine 是本插件存在的理由。 */
export const inject = ['tools', 'workflowEngine']

/**
 * 脚本体。引擎不会对这段文本求值来取 meta 或 args——它们是普通 JSON 数据，
 * 由引擎校验后原样暴露成脚本里的全局量。结尾必须 return 一个 JSON 值。
 */
const SCRIPT = `
const tasks = args.tasks
phase('调查')
const settled = await parallel(tasks.map((task, index) => async () => {
    const finding = await agent('调查第 ' + (index + 1) + ' 件事：' + task)
    return { task: task, finding: finding }
}))
// 逐项 null 表示那一项的子运行失败了；这里保留下来交给调用方判断。
return settled.filter((item) => item !== null)
`

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'fan_out',
        description: '把一批互不依赖的小任务并发派给子 agent，返回各自的结论。',
        parameters: {
            type: 'object' as const,
            properties: {
                tasks: {
                    type: 'array' as const,
                    items: { type: 'string' as const },
                    description: '要并行调查的事项，每条一句话。',
                },
            },
            required: ['tasks'],
        },
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: async (args, exec) => {
            const parent = exec.agent
            if (parent === undefined) return 'no agent-bound caller'
            const tasks = (args as { tasks?: string[] }).tasks ?? []
            if (tasks.length === 0) return '没有要跑的活。'

            const run = ctx.workflowEngine.start({
                script: SCRIPT,
                meta: {
                    name: 'fan-out',
                    description: '并发派活并汇总各自的结论',
                    phases: [{ title: '调查' }],
                },
                args: { tasks },
                parent,
            })

            // result 永不 reject：脚本失败会以 stopReason 兑现，不是异常。
            const result = await run.result
            // 每个持有者都必须在每条路径上 dispose，它同时负责等子 agent 停稳。
            await run.dispose()

            if (result.stopReason !== 'completed') {
                return `这一轮没跑完（${result.stopReason}）：${result.error ?? '没有更多信息'}`
            }
            return JSON.stringify({ started: result.agentsStarted, found: result.value }, null, 2)
        },
    }))
}
