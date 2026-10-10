/**
 * 从长驻终端的有界 scrollback 里取一页，并把四个分页坐标原样交给模型。
 *
 * 这个插件是**消费者**：它不注册后端、不碰 PTY，只调 `ctx.terminals` 上
 * 那几个方法。工具名与参数刻意和内置的 `terminal_read` 对齐——它演示的是
 * 「同一个服务怎么从另一个插件里用」，不是又一个终端工具。
 *
 * @module dsh-nav-kit/terminal-journal
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { TerminalSessionId } from '@deepseek-ai/dsh-terminal'

/** Cordis 插件名 */
export const name = 'nav-kit-terminal-journal'

/** 终端注册表不在就没有会话可读，工具注册表不在就注册不了工具。 */
export const inject = ['terminals', 'tools']

/** 插件配置 */
export interface Config {
    /** 一页最多要多少行。后端仍会按字节上限再截一次。 */
    pageLines: number
}

/** Schemastery 校验：默认值写在这里，不藏在 execute 里。 */
export const Config: Schema<Config> = Schema.object({
    pageLines: Schema.number().default(200),
})

/**
 * 注册 terminal_journal 工具。
 *
 * @param ctx - 插件上下文。
 * @param config - 已解析的配置。
 */
export function apply(ctx: Context, config: Config): void {
    ctx.tools.register(defineTool({
        name: 'terminal_journal',
        description:
            '读取某个长驻终端会话保留输出的一页，返回文本与分页坐标。'
            + '这些坐标可以从最后一次调用往前连续翻页，用来回看一段被截断的构建日志。',
        parameters: {
            sessionId: {
                type: 'string',
                required: true,
                description: 'terminal_open 返回的会话 id，或 terminal_list 里列出的那个。',
            },
            offset: {
                type: 'integer',
                description: '相对最新一行的偏移，0 表示从最新一页往回数。每次翻页把它加上上一页的行数即可。',
            },
        },
        output: {
            schema: { type: 'string' },
            render: (_args, value: string) => [{ type: 'text', text: value }],
        },
        // 纯读，不改任何共享状态：允许和同一批里的其他调用并行。
        isConcurrencySafe: () => true,
        execute(args, exec) {
            const owner = exec.agent
            if (owner === undefined) throw new Error('terminal_journal 需要一个发起它的 agent')

            // 归属校验在服务里：这不是防重名，是防串号。
            // 先自己列一遍只是为了给出一句人话，真正的 FOREIGN_SESSION / NO_SESSION
            // 判定仍在 ctx.terminals 内部，按的是确切的 owner 对象。
            const known = ctx.terminals.list(owner)
            if (!known.some(snapshot => String(snapshot.sessionId) === args.sessionId)) {
                throw new Error(`这个 agent 名下没有会话 ${args.sessionId}；先用 terminal_list 看一眼。`)
            }

            const page = ctx.terminals.read(owner, TerminalSessionId(args.sessionId), {
                offset: args.offset ?? 0,
                // count 只是请求：后端还会按 maxReadBytes 从 UTF-8 尾部再截一次。
                count: config.pageLines,
            })

            return [
                page.text,
                '',
                `— 第 ${page.lineBegin}..${page.lineEnd} 行（相对最新），共保留 ${page.totalLines} 行`
                + `${page.truncated ? '；更老的输出或本次结果撞上了上限' : ''}`,
            ].join('\n')
        },
    }))
}
