/**
 * 把自己的 Markdown 笔记接到 Web 搜索 seam 上。
 *
 * 这个插件只做一件事：向 `ctx.web` 注册一个 `WebSearchProvider`。
 * 它不知道搜索请求是谁发起的（模型的 `web_search` 工具？还是一个 HTTP 路由？），
 * 也不需要知道——消费者认的是 `ctx.web` 这个名字，不是它。
 */
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {
    WebSearchProvider,
    WebSearchRequest,
    WebSearchResult,
    WebSearchSource,
} from '@deepseek-ai/dsh-web'

export const name = 'dsh-notes-search'

/** 必需依赖：`ctx.web` 不在，本插件就不启动。 */
export const inject = ['web']

/** provider 在 seam 里的唯一键；`web` 行的 config 用它选中我们。 */
export const PROVIDER_ID = 'notes-local'

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
/** 单次搜索最多看这么多文件，免得一次查询把磁盘翻个底朝天。 */
const MAX_FILES = 2000

export interface Config {
    /** 笔记根目录；不配就是"没准备好"，由 available() 报告。 */
    root?: string
    /** 返回的摘要最多多少字符。 */
    snippetChars: number
}

export const Config: Schema<Config> = Schema.object({
    root: Schema.string(),
    snippetChars: Schema.number().step(1).min(1).default(160),
})

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

/** 笔记里第一行命中关键词的正文；一行都没命中就返回 undefined。 */
function findLine(lines: readonly string[], terms: readonly string[]): string | undefined {
    return lines.find(line => terms.some(term => line.toLowerCase().includes(term)))
}

class NotesSearchProvider implements WebSearchProvider {
    /** seam 用它做注册表的键，也是 `searchProvider` 配置里写的那个值。 */
    readonly id = PROVIDER_ID

    // 不用参数属性（`constructor(private readonly config: Config)`）：
    // dsh 直接跑你的 .ts，走 Node 的类型擦除，参数属性这种"带运行时代码的类型语法"
    // 不在可擦除范围内，会直接 import 失败。
    private readonly config: Config

    constructor(config: Config) {
        this.config = config
    }

    /**
     * 廉价的本地检查：只看目录在不在。
     * 这里发网络请求的话，每次搜索前都要付一次往返——所以约定禁止。
     */
    available(): boolean {
        return this.config.root !== undefined && existsSync(this.config.root)
    }

    async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
        const root = this.config.root
        // available() 已经拦过没配 root 的情况，这里只是收窄类型。
        if (root === undefined) return { sources: [], truncated: false }

        const terms = request.query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
        const limit = this.config.snippetChars
        const sources: WebSearchSource[] = []
        for (const path of await collectFiles(root)) {
            // 用户点停止时 signal 会被中止：每读一篇查一次，别把已经没人要的结果做完
            signal?.throwIfAborted()
            const lines = (await readFile(path, 'utf8')).split('\n')
            const hit = findLine(lines, terms)
            if (hit === undefined) continue
            const relativePath = relative(root, path)
            const title = lines.find(line => line.startsWith('#'))?.replace(/^#+\s*/, '').trim() || relativePath
            const snippet = hit.trim()
            sources.push({
                // 我们的源不是网页，就自己定一个 scheme；seam 只要求 url 是个字符串。
                url: `note://${relativePath}`,
                title,
                snippet: hit.length <= limit ? hit : `${hit.slice(0, limit)}…`,
            })
        }

        return {
            content: `本地笔记检索：命中 ${sources.length} 篇（关键词 ${terms.join(' / ')}）`,
            sources,
            // 截断交给 seam：maxResults 是消费者给的上限，provider 只负责"我找到了这些"。
            truncated: false,
        }
    }
}

export function apply(ctx: Context, config: Config): void {
    ctx.web.registerSearchProvider(new NotesSearchProvider(config))
    // 07 篇说过：ctx.logger 不往终端打，所以想要一行肉眼可见的证据就自己 console.log。
    console.log(`[${name}] 已注册 provider ${PROVIDER_ID}（root=${config.root ?? '(未配置)'}）`)
}
