/**
 * 给模型一个搜索本地笔记的工具：note_search。
 *
 * 08 篇是把已有工具（web_search）背后的能力换成自己的实现；这个插件做的
 * 是另一件事——注册一个模型本来没有的工具。注册进 ctx.tools 之后，下一次
 * 模型请求的工具清单里就有它，模型按 name / description / parameters 决定
 * 什么时候调、怎么填参数。
 */
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join, relative } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-note-search'

/** 必需依赖：工具注册表不在，本插件就不启动。 */
export const inject = ['tools']

export interface Config {
    /** 笔记根目录；开头是 `~` 时展开成本人主目录。 */
    root: string
}

export const Config: Schema<Config> = Schema.object({
    root: Schema.string().default('~/notes'),
})

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
/** 一次搜索最多看的文件数，给遍历一个上界。 */
const MAX_FILES = 2000

/** 一条命中：相对路径、1-based 行号（0 表示文件名命中）、那一行的内容。 */
interface Hit {
    path: string
    line: number
    snippet: string
}

/** 展开路径开头的 `~`；配置里写绝对路径时原样返回。 */
function expandHome(path: string): string {
    if (path === '~') return homedir()
    if (path.startsWith('~/')) return join(homedir(), path.slice(2))
    return path
}

/** 列出 root 下所有像笔记的文件，跳过点开头的目录（.git、.obsidian 之类）。 */
async function collectFiles(root: string): Promise<string[]> {
    const found: string[] = []
    const queue = [root]
    while (queue.length > 0 && found.length < MAX_FILES) {
        const dir = queue.shift() as string
        let entries
        try {
            entries = await readdir(dir, { withFileTypes: true })
        } catch {
            continue
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue
            const full = join(dir, entry.name)
            if (entry.isDirectory()) queue.push(full)
            else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(full)
        }
    }
    return found
}

/** 在 root 里找所有包含 query 的行（大小写不敏感），文件名本身也算一个可命中的单位。 */
async function search(root: string, query: string, signal: AbortSignal): Promise<Hit[]> {
    const hits: Hit[] = []
    const needle = query.toLowerCase()
    for (const path of await collectFiles(root)) {
        // 用户点停止时 signal 会被中止：每读一篇查一次，别把已经没人要的结果做完
        signal.throwIfAborted()
        const relativePath = relative(root, path)
        if (relativePath.toLowerCase().includes(needle)) {
            hits.push({ path: relativePath, line: 0, snippet: relativePath })
        }
        const lines = (await readFile(path, 'utf8')).split('\n')
        lines.forEach((text, index) => {
            if (text.toLowerCase().includes(needle)) {
                hits.push({ path: relativePath, line: index + 1, snippet: text.trim() })
            }
        })
    }
    return hits
}

/** 把规范值排成模型读的文本：一行一条命中，结尾交代总数与截断。 */
function formatHits(value: { hits: Hit[]; total: number }): string {
    if (value.total === 0) return '笔记里没有命中。'
    const lines = value.hits.map(hit => hit.line === 0
        ? `- ${hit.path}（文件名命中）`
        : `- ${hit.path}:${hit.line} — ${hit.snippet}`)
    const suffix = value.total > value.hits.length
        ? `\n\n（共 ${value.total} 条命中，只显示了前 ${value.hits.length} 条。调大 limit 或换个更精确的关键词可以看到更多。）`
        : ''
    return `${lines.join('\n')}${suffix}`
}

export function apply(ctx: Context, config: Config): void {
    const root = expandHome(config.root)
    ctx.tools.register(defineTool({
        name: 'note_search',
        description: '在本地的 Markdown / 纯文本笔记里按关键词检索，文件名和正文都会匹配。返回命中行的路径、行号和内容片段。',
        parameters: {
            query: { type: 'string', required: true, description: '要检索的关键词，大小写不敏感。' },
            limit: { type: 'integer', description: '最多返回多少条命中，默认 5。' },
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
                                path: { type: 'string', required: true },
                                line: { type: 'integer', required: true },
                                snippet: { type: 'string', required: true },
                            },
                        },
                    },
                    total: { type: 'integer', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: formatHits(value) }],
            // 把命中列表投影进 tool/result 的 meta 落盘：结果卡片（第 15 篇）从 meta 取回它。
            presentationMeta: (_args, value) => ({ hits: value.hits }),
        },
        // 只读检索，不改任何共享状态：允许和同一批里的其他工具调用并行。
        isConcurrencySafe: () => true,
        async execute(args, exec) {
            // schema DSL 表达不了的约束（非空、正数）在函数体里自己查；抛出的
            // Error 会变成这次调用的 isError 结果，消息原文发给模型。
            const query = args.query.trim()
            if (query.length === 0) throw new Error('query 不能为空字符串')
            const limit = args.limit ?? 5
            if (limit < 1) throw new Error('limit 必须是正整数')
            if (!existsSync(root)) throw new Error(`笔记根目录不存在：${root}`)
            const hits = await search(root, query, exec.signal)
            return { hits: hits.slice(0, limit), total: hits.length }
        },
        presentCall: args => ({ card: 'generic', title: args.query, kind: 'search' }),
    }))
    console.log(`[${name}] note_search 已注册（root=${root}）`)
}
