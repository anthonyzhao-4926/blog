/**
 * 把 `engines.dsh` 从「没人读的声明」变成自己的硬检查：
 * 启动时在日志里报一次内核版本，并挂一条 HTTP 报告。
 *
 * @module dsh-upgrade-guard
 */
import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import { readKernelVersion, satisfiesCaret } from './kernel-version.ts'

export const name = 'dsh-upgrade-guard'

/** 本插件自己的版本，只用于和内核版本并排展示。 */
function readOwnVersion(): string {
    try {
        const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: unknown }
        return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
    } catch {
        return '0.0.0'
    }
}

/** 可配置项。 */
export interface Config {
    /** 本插件支持的内核版本区间；空字符串表示只报告、不判定。 */
    enginesDsh: string
}

/**
 * @param ctx - 插件上下文。
 * @param config - 已校验的配置。
 */
export function apply(ctx: Context, config: Config): void {
    const kernel = readKernelVersion()
    // 启动就先在日志里报一次，这样「起不来」之前也能在 stderr 看到事实。
    console.log(
        `[${name}] kernel=${kernel === undefined ? '未确认' : `${kernel.name}@${kernel.version}`}`
        + ` own=${readOwnVersion()}`,
    )

    // connection 是可选的：headless 装配下没有它，插件照常加载，只是没有报告面。
    ctx.inject(['connection'], (connCtx) => {
        connCtx.connection.fetch.register({
            path: '/api/dsh-upgrade-guard/report',
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => new Response(JSON.stringify({
                own: readOwnVersion(),
                kernel: kernel ?? null,
                enginesDsh: config.enginesDsh,
                satisfied: kernel === undefined || config.enginesDsh === ''
                    ? null
                    : satisfiesCaret(config.enginesDsh, kernel.version),
                note: 'engines.dsh 由本插件自己判：DSH 没有任何代码读它',
            }), { headers: { 'content-type': 'application/json; charset=utf-8' } }),
        })
    })
}
