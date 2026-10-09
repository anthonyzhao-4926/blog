/**
 * 找出「我这个插件实际拿到的内核是哪一版」。
 *
 * dsh 自己没有任何服务或事件暴露内核版本（`dsh --version` 只是运行时读
 * CLI 包的 package.json），所以只能从「解析到的包清单」推：插件解析到
 * 哪一份 `@deepseek-ai/dsh-*`，就是它接下来要按哪一套 API 说话。
 *
 * @module dsh-upgrade-guard/kernel-version
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

/**
 * 依次尝试几个候选包名，返回第一个能解析到的那份清单版本。
 * 先试 CLI 包（npm 必定发布它的 package.json），再退回本插件一定依赖的
 * `@deepseek-ai/dsh-tools`（它显式暴露了 `./package.json`）。
 * @returns 包名与版本；两个候选都解析不到时返回 undefined。
 */
export function readKernelVersion(): { name: string, version: string } | undefined {
    for (const name of ['@deepseek-ai/dsh', '@deepseek-ai/dsh-tools']) {
        try {
            const path = createRequire(import.meta.url).resolve(`${name}/package.json`)
            const manifest = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown }
            if (typeof manifest.version === 'string') return { name, version: manifest.version }
        } catch {
            // 解析不到就试下一个；两个都试不到由调用方报「未确认」。
        }
    }
    return undefined
}

/**
 * 判定 `^x.y.z-pre` 形状的区间是否接受某个版本。
 *
 * 规则出自发布序列说明：带预发布的区间只接受「与带预发布那一端同
 * major.minor.patch 的预发布」，其余预发布一律不满足；稳定版只要落在
 * 区间内就满足。这里只实现本篇要用的形状，不追求完整 semver。
 * @param range - 形如 `^0.2.0-rc.2` 的区间。
 * @param version - 待判定的版本号。
 * @returns 是否满足。
 */
export function satisfiesCaret(range: string, version: string): boolean {
    const want = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(range.trim().replace(/^\^/, ''))
    const got = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version.trim())
    if (want === null || got === null) return false
    // 主版本必须相同：^ 不允许跨大版本。
    if (want[1] !== got[1]) return false
    if (got[4] === undefined) {
        // 稳定版：同 minor 且 patch 不低于区间下界即满足。
        return want[2] === got[2] && Number(got[3]) >= Number(want[3])
    }
    // 预发布版：区间自身也得带预发布，且三段号必须完全一致。
    if (want[4] === undefined) return false
    return want[2] === got[2] && want[3] === got[3]
}
