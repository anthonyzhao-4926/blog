/**
 * 读当前会话的待办清单，按三态汇总。
 *
 * 为什么值得做个工具：todo 列表是**整表替换**的——每次写入都带一份完整的
 * 新列表，谁后写谁生效。正因为是整体替换，列表项**故意不带 id**：没有稳定
 * 身份可指，也就不需要它。这个工具把这件事变得可见：它不记增量，只认最新
 * 那一份完整快照。
 *
 * `todo/write` 是 log-only 事件（只进会话日志，不进模型上下文），所以读它
 * 的办法是自己折日志——从会话头顺着 seq 扫一遍，保留最后一条。
 *
 * @module dsh-todo-digest
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只引入类型声明：todo/write 的 SessionEventMap 合并，以及会话类型。
import type {} from '@deepseek-ai/dsh-tool-todo'

export const name = 'dsh-todo-digest'

/** tools 用来注册工具；不需要别的服务，清单从会话日志里自己折。 */
export const inject = ['tools']

/** 一条待办：只有内容与三态，没有 id、优先级这些字段。 */
interface TodoItem {
    content: string
    status: 'pending' | 'in_progress' | 'completed'
}

/**
 * 顺着会话日志折出最后一份完整的待办快照。
 * @param session - 要读的会话。
 * @returns 最新的一份列表；从没写过时为空数组。
 */
function latestTodos(session: { seq: number, eventAt(seq: number): unknown }): TodoItem[] {
    let todos: TodoItem[] = []
    for (let index = 0; index < session.seq; index += 1) {
        const event = session.eventAt(index) as { type?: string, data?: { todos?: TodoItem[] } } | undefined
        // 整表替换：不需要合并，直接覆盖。
        if (event?.type === 'todo/write' && event.data?.todos !== undefined) {
            todos = event.data.todos
        }
    }
    return todos
}

export function apply(ctx: Context): void {
    ctx.tools.register(defineTool({
        name: 'todo_digest',
        description: '汇总当前会话的待办清单，按进行中、待办、已完成分组。',
        parameters: {},
        output: {
            schema: { type: 'string' as const },
            render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
        },
        execute: (_args, exec) => {
            const session = exec.agent?.session
            if (session === undefined) return 'no agent-bound caller'
            const todos = latestTodos(session)
            if (todos.length === 0) return '这个会话还没有写过待办清单。'

            const group = (status: TodoItem['status']): string[] =>
                todos.filter((item) => item.status === status).map((item) => `  - ${item.content}`)

            const sections: string[] = []
            const running = group('in_progress')
            if (running.length > 0) sections.push(`进行中（${running.length}）：\n${running.join('\n')}`)
            const pending = group('pending')
            if (pending.length > 0) sections.push(`待办（${pending.length}）：\n${pending.join('\n')}`)
            const done = group('completed')
            if (done.length > 0) sections.push(`已完成（${done.length}）：\n${done.join('\n')}`)
            return sections.join('\n\n')
        },
    }))
}
