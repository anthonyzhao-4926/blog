/**
 * 会话格式体检：只看，不改。
 *
 * 它在两处取数据，恰好是这一篇要讲的分界：
 *   1) 磁盘上的**物理世代**——每个会话目录里 `session[.vN].jsonl[.zstd]` 的文件名。
 *      公开 API 不暴露它，所以只能用官方那个文件名解析器自己扫。
 *   2) 正规 API `ctx.sessionPersistence.list()` 给的**逻辑头**——版本恒为当前写入器。
 *
 * 两边都不写：不 `open(id, 'write')`，不 publish，不迁移。
 *
 * @module dsh-session-audit
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { parseSessionFormatLogFilename } from '@deepseek-ai/dsh-session-format'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import Schema from '@deepseek-ai/schemastery'

/** Cordis 插件名 */
export const name = 'dsh-session-audit'

/** 工具注册表与持久化 seam 都是必需的。 */
export const inject = ['tools', 'sessionPersistence']

/** 可配置项。 */
export interface Config {
    /** 会话根；留空时取 `$DSH_HOME/sessions`。 */
    sessionsRoot: string
}

/** Schemastery 校验：默认值写在这里，写错类型在加载期就报。 */
export const Config: Schema<Config> = Schema.object({
    sessionsRoot: Schema.string().default(''),
})

/** 一个会话目录的体检结果。 */
interface StoredSession {
    /** 目录名（会话 id 被转义成的单一路径段）。 */
    dir: string
    /** 磁盘上最高的规范世代。 */
    generation: number
}

/**
 * 从压缩后缀里剥出规范文件名。
 *
 * 压缩是后端在规范名之后追加的，所以解析世代前要先去掉 `.zstd`。
 *
 * @param filename - 目录里读到的原始文件名。
 * @returns 不含压缩后缀的文件名。
 */
function withoutCompressionSuffix(filename: string): string {
    return filename.endsWith('.zstd') ? filename.slice(0, -'.zstd'.length) : filename
}

/**
 * 扫一遍会话根，取出每个会话目录的最高规范世代。
 *
 * 目录层次是 `<root>/<项目目录>/<会话目录>/<日志文件>`。用的解析器是官方那个
 * `parseSessionFormatLogFilename`——临时名、大写、前导零、`.v0` 都不是规范名，
 * 自己写正则很容易把它们当成世代。
 *
 * @param root - 会话根目录。
 * @returns 每个有日志的会话目录及其最高世代。
 */
function scanStoredSessions(root: string): StoredSession[] {
    const found: StoredSession[] = []
    for (const project of readdirSync(root, { withFileTypes: true })) {
        if (!project.isDirectory()) continue
        const projectDir = join(root, project.name)
        for (const session of readdirSync(projectDir, { withFileTypes: true })) {
            if (!session.isDirectory()) continue
            let highest: number | undefined
            for (const file of readdirSync(join(projectDir, session.name))) {
                const version = parseSessionFormatLogFilename(withoutCompressionSuffix(file))
                if (version === undefined) continue
                if (highest === undefined || version > highest) highest = version
            }
            if (highest !== undefined) found.push({ dir: session.name, generation: highest })
        }
    }
    return found
}

/**
 * 给一个物理世代下结论。
 *
 * @param generation - 磁盘上的世代。
 * @param writerVersion - 当前写入器版本。
 * @returns 结论码。
 */
function verdictOf(generation: number, writerVersion: number): string {
    if (generation > writerVersion) return 'needs-newer-harness'
    if (generation < writerVersion) return 'migration-required'
    return 'current'
}

/**
 * 注册 `session_format_audit`。
 *
 * @param ctx - 插件上下文。
 * @param config - 已解析的配置。
 */
export function apply(ctx: Context, config: Config): void {
    const root = config.sessionsRoot === '' ? dshHomePath('sessions') : config.sessionsRoot

    ctx.tools.register(defineTool({
        name: 'session_format_audit',
        description:
            '体检本机会话文件的格式版本：磁盘上是第几代、当前构建能不能直接打开、'
            + '有没有需要迁移的。只读，不迁移、不发布。',
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    writerVersion: { type: 'integer', required: true },
                    sessionsRoot: { type: 'string', required: true },
                    storedSessions: { type: 'integer', required: true },
                    migrationRequired: { type: 'integer', required: true },
                    needsNewerHarness: { type: 'integer', required: true },
                    logicalSessions: { type: 'integer', required: true },
                },
            },
            render: (_args, value) => [{
                type: 'text',
                text: `写入器版本 ${value.writerVersion} · 会话根 ${value.sessionsRoot}\n`
                    + `磁盘上 ${value.storedSessions} 个会话：需迁移 ${value.migrationRequired}，`
                    + `需更新 harness ${value.needsNewerHarness}\n`
                    + `正规 API 看到 ${value.logicalSessions} 个会话（逻辑头恒为写入器版本）`,
            }],
        },
        // 只读本地目录，允许和其他调用并行。
        isConcurrencySafe: () => true,
        async execute() {
            if (!existsSync(root)) {
                // 读不到就说清楚读不到，别让模型去猜是权限还是路径。
                throw new Error(`会话根不存在：${root}（用 config.sessionsRoot 指定别处）`)
            }
            const stored = scanStoredSessions(root)

            // 正规 API：拿的是翻译过的逻辑头，不是磁盘上的世代。
            const logical = await ctx.sessionPersistence.list()

            const migrationRequired = stored
                .filter(entry => verdictOf(entry.generation, SESSION_FORMAT_VERSION) === 'migration-required')
                .length
            const needsNewerHarness = stored
                .filter(entry => verdictOf(entry.generation, SESSION_FORMAT_VERSION) === 'needs-newer-harness')
                .length

            return {
                writerVersion: SESSION_FORMAT_VERSION,
                sessionsRoot: root,
                storedSessions: stored.length,
                migrationRequired,
                needsNewerHarness,
                logicalSessions: logical.length,
            }
        },
    }))

    console.log(`[${name}] 已装：会话根 ${root}，写入器版本 ${SESSION_FORMAT_VERSION}`)
}
