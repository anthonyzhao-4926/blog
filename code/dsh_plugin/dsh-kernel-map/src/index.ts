/**
 * 把 DSH 生成的事件地图读成可查询的服务面：解析 docs/event-producer-consumer.md，
 * 注册一个只读工具，再挂一条 HTTP 报告。
 *
 * 这份地图是 gen-doc-graphs.ts 用仓库的 TypeScript Program 解析出来的，每一行都
 * 带一个 `路径:行号` 指针和分发模式。它是**机械可核对**的，所以插件可以依赖它；
 * 手抄一份目录进自己的代码就会烂——那正是仓库文档规范里点名的 slop。
 *
 * @module dsh-kernel-map
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
// 只为模块增强：ctx.connection 的类型。
import type {} from '@deepseek-ai/dsh-client-connection'

/** Cordis 插件名 */
export const name = 'dsh-kernel-map'

/** 工具注册表是必需的；报告面用 ctx.inject 机会性读取。 */
export const inject = ['tools']

/** 可配置项。 */
export interface Config {
    /** DSH 检出目录；矩阵文件相对它解析。 */
    repoRoot: string
}

/** 事件矩阵里的一行。 */
interface EventRow {
    /** 事件名，例如 agent/pre-step。 */
    event: string
    /** 分发模式：emit / bail / serial / waterfall / parallel。 */
    mode: string
    /** 声明处的源码指针，例如 packages/core/agent/src/runtime-types.ts:330。 */
    declaredIn: string
}

/**
 * 解析 gen-doc-graphs.ts 生成的事件矩阵。
 *
 * 只认「三个单元格都是反引号包起来的」那种行——表头、分隔行与说明段自然被跳过，
 * 不需要额外维护一张排除清单。
 *
 * @param markdown - docs/event-producer-consumer.md 的正文。
 * @returns 逐行解析出的事件。
 */
function parseEventMatrix(markdown: string): EventRow[] {
    const rows: EventRow[] = []
    for (const line of markdown.split('\n')) {
        const cells = line.split('|').map(cell => cell.trim())
        const event = /^`([^`]+)`$/u.exec(cells[1] ?? '')?.[1]
        const mode = /^`([^`]+)`$/u.exec(cells[2] ?? '')?.[1]
        const declaredIn = /^\[`([^`]+)`\]/u.exec(cells[3] ?? '')?.[1]
        if (event !== undefined && mode !== undefined && declaredIn !== undefined) {
            rows.push({ event, mode, declaredIn })
        }
    }
    return rows
}

/**
 * 注册工具与报告面。
 *
 * @param ctx - 插件上下文。
 * @param config - 已解析的配置。
 */
export function apply(ctx: Context, config: Config): void {
    const matrixPath = join(config.repoRoot, 'docs/event-producer-consumer.md')
    const rows = parseEventMatrix(readFileSync(matrixPath, 'utf8'))

    const byMode: Record<string, number> = {}
    for (const row of rows) byMode[row.mode] = (byMode[row.mode] ?? 0) + 1

    ctx.tools.register(defineTool({
        name: 'kernel_event_map',
        description:
            '查询 DSH 的事件地图：按分发模式或名字片段列出事件，附声明处的源码位置。'
            + '数据来自仓库里那份机械生成的文档，不是靠记忆。',
        parameters: {
            mode: { type: 'string', description: '只看这一种分发模式，例如 waterfall。' },
            filter: { type: 'string', description: '事件名里包含这个子串。' },
            limit: { type: 'integer', description: '最多返回多少条，默认 10。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    hits: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                event: { type: 'string', required: true },
                                mode: { type: 'string', required: true },
                                declaredIn: { type: 'string', required: true },
                            },
                        },
                    },
                    total: { type: 'integer', required: true },
                },
            },
            render: (_args, value) => [{
                type: 'text',
                text: `${value.total} 条命中\n`
                    + value.hits.map(hit => `${hit.event}  [${hit.mode}]  ${hit.declaredIn}`).join('\n'),
            }],
        },
        // 只读内存里那份表格，允许和其他调用并行。
        isConcurrencySafe: () => true,
        execute(args) {
            const hits = rows.filter(row =>
                (args.mode === undefined || row.mode === args.mode)
                && (args.filter === undefined || row.event.includes(args.filter)))
            return { hits: hits.slice(0, args.limit ?? 10), total: hits.length }
        },
    }))

    // connection 是可选的：headless 装配下没有它，插件照常加载，只是没有报告面。
    // register 内部已经把注销绑进调用方的 effect，插件卸载时路由自己消失。
    ctx.inject(['connection'], (connCtx) => {
        connCtx.connection.fetch.register({
            path: '/api/dsh-kernel-map/report',
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => new Response(JSON.stringify({
                total: rows.length,
                byMode,
                source: matrixPath,
            }, null, 2), {
                headers: { 'content-type': 'application/json; charset=utf-8' },
            }),
        })
    })

    console.log(`[${name}] 读入 ${rows.length} 条事件，来源 ${matrixPath}`)
}
