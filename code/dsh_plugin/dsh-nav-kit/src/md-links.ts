/**
 * 把 `[[笔记名]]` 当成符号的代码导航提供方。它不启动任何语言服务器，
 * 只查文件系统——但走的是和真 LSP provider 完全相同的那个契约。
 *
 * 一个 provider 只有三件东西：id、扩展名到 languageId 的映射、query。
 * 没有进程、没有协议帧、没有文档同步，那些都是 stdio provider 自己的事。
 *
 * @module dsh-nav-kit/md-links
 */
import type { Context } from '@deepseek-ai/cordis'
import { LspProviderId } from '@deepseek-ai/dsh-lsp'
import type { LspLocation, LspProvider, LspProviderQuery, LspQueryResult, LspRange } from '@deepseek-ai/dsh-lsp'
// 只为模块增强与类型：ctx.fs 服务、目录项与已解析目标的形状。
import type { FsDirEntry, FsTarget } from '@deepseek-ai/dsh-fs'

/** Cordis 插件名 */
export const name = 'nav-kit-md-links'

/** 只依赖文件系统与 LSP seam；两个都得先在场，否则本插件不启动。 */
export const inject = ['lsp', 'fs']

/** provider 身份。注册时它和全部扩展名会被一起原子预留。 */
const PROVIDER_ID = LspProviderId('dsh-nav-kit/md-links')

/** 递归收集笔记的最大层数，给遍历一个上界。 */
const MAX_DEPTH = 4

/**
 * 构造一个零宽范围。
 *
 * 这个「语言」里符号没有列信息，位置一律用整行的零宽范围表示；坐标是
 * 从 0 开始的 UTF-16，和 LSP 线上协议一致。
 *
 * @param line - 从 0 开始的行号。
 * @returns 该行行首的零宽范围。
 */
function atLine(line: number): LspRange {
    return { start: { line, character: 0 }, end: { line, character: 0 } }
}

/**
 * 取某一行里的第一个 wiki 链接目标。
 *
 * @param source - 整篇笔记文本。
 * @param line - 从 0 开始的行号。
 * @returns 链接目标（已去掉别名与锚点）；这一行没有链接时返回 undefined。
 */
function targetAt(source: string, line: number): string | undefined {
    const row = source.split('\n')[line] ?? ''
    return /\[\[([^\]|#]+)/u.exec(row)?.[1]?.trim()
}

/**
 * 取一个笔记文件的库名：丢掉目录与 `.md` 后缀。
 *
 * @param displayPath - 目标面向展示的路径。
 * @returns 用于和 `[[...]]` 比对的名字。
 */
function noteName(displayPath: string): string {
    const base = displayPath.split('/').pop() ?? displayPath
    return base.replace(/\.md$/u, '')
}

/**
 * 从工作区根开始递归收集所有 Markdown 文件。
 *
 * 用 `ctx.fs.listDir` 而不是 `node:fs`：列目录这件事属于文件系统 seam，
 * 换成沙箱后端或远端后端时这里一行都不用改。
 *
 * @param fs - 文件系统服务。
 * @param root - 已解析的工作区根。
 * @param depth - 还能往下钻几层。
 * @returns 解析好的文件目标，顺序由后端决定。
 */
async function collectNotes(fs: Context['fs'], root: FsTarget, depth: number = MAX_DEPTH): Promise<FsTarget[]> {
    const found: FsTarget[] = []
    let entries: FsDirEntry[]
    try {
        entries = await fs.listDir(root)
    } catch {
        // 列不动就当作没有：导航查不到东西不该把这一轮弄崩。
        return found
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (entry.type === 'directory') {
            if (depth > 0) found.push(...await collectNotes(fs, entry.target, depth - 1))
        } else if (entry.type === 'file' && entry.name.endsWith('.md')) {
            found.push(entry.target)
        }
    }
    return found
}

/**
 * 注册这个提供方。
 *
 * @param ctx - 插件上下文。
 */
export function apply(ctx: Context): void {
    const provider: LspProvider = {
        id: PROVIDER_ID,
        // 键必须是小写、带前导点。同一个扩展名只能归一个 provider，
        // 冲突和重复都在注册时就拒掉，不会等到查询时才炸。
        extensionToLanguage: { '.md': 'markdown' },

        async query(request: LspProviderQuery): Promise<LspQueryResult> {
            // 工作区根由调用方给，provider 自己规范化，再把权威 URI 一起回传。
            // 调用方要相对化 location 时必须用这个 URI，不能拿请求里那条
            // 可能含符号链接的进程路径去按本地平台规则猜。
            const root = await ctx.fs.resolve(request.workspaceRoot)
            const resolvedWorkspaceUri = ctx.fs.fileUrl(root)

            const source = await ctx.fs.readText(
                await ctx.fs.resolve(request.filePath, { cwd: request.workspaceRoot }),
            )
            const target = targetAt(source, request.position.line)

            if (request.operation === 'hover') {
                // 悬停不移动光标：查不到就给 null，而不是空字符串。
                return {
                    kind: 'hover',
                    hover: target === undefined ? null : { contents: `wiki 链接 → ${target}` },
                }
            }

            if (request.operation === 'goToImplementation') {
                // 这个「语言」里没有接口与实现之分。返回空数组是合法的——
                // 四种操作是 seam 的闭合联合，provider 不必每个都有货。
                return { kind: 'locations', locations: [], resolvedWorkspaceUri }
            }

            if (target === undefined) {
                return { kind: 'locations', locations: [], resolvedWorkspaceUri }
            }

            const notes = await collectNotes(ctx.fs, root)

            if (request.operation === 'goToDefinition') {
                const definitions = notes.filter(note => noteName(note.displayPath) === target)
                return {
                    kind: 'locations',
                    locations: definitions.map((note): LspLocation => ({
                        uri: ctx.fs.fileUrl(note),
                        range: atLine(0),
                    })),
                    resolvedWorkspaceUri,
                }
            }

            // findReferences：扫所有笔记里引用了这个链接的行。
            // 「结果永远包含声明本身」是 provider 的责任——host 固定发
            // includeDeclaration，调用方拿不到那个开关，也就忘不掉这件事。
            const references: LspLocation[] = []
            for (const note of notes) {
                const text = await ctx.fs.readText(note)
                const uri = ctx.fs.fileUrl(note)
                text.split('\n').forEach((row, index) => {
                    if (row.includes(`[[${target}`)) references.push({ uri, range: atLine(index) })
                })
            }
            return { kind: 'locations', locations: references, resolvedWorkspaceUri }
        },
    }

    // 注册是原子的：id 与每个扩展名一起校验、一起预留，任何冲突都不发布任何东西。
    ctx.lsp.registerProvider(provider)
    console.log(`[${name}] 已注册 provider ${PROVIDER_ID}，接管 .md`)
}
