/**
 * `./invariant` companion：内核版本不满足就启动即炸。
 *
 * 运行期不变式服务默认不在 base 组合里（`dsh-base` 刻意不挂），
 * 所以本插件的 cordis.patch.yml 自己把服务插进来。
 *
 * @module dsh-upgrade-guard/invariant
 */
import type { Context } from '@deepseek-ai/cordis'
import { readKernelVersion, satisfiesCaret } from './kernel-version.ts'

export const name = 'dsh-upgrade-guard-invariant'

/** 没有不变式注册表就不起——它整个存在的意义就是注册一条。 */
export const inject = ['invariants']

/** 与 package.json 的 engines.dsh 保持同一个值。 */
const REQUIRED = '^0.2.0-rc.2'

/**
 * @param ctx - 插件上下文，必须已注入 invariants。
 */
export function apply(ctx: Context): void {
    ctx.invariants.register('dsh-upgrade-guard', (_ctx, fail) => {
        const kernel = readKernelVersion()
        if (kernel === undefined) {
            fail('无法确认内核版本；插件依赖 @deepseek-ai/dsh-tools/package.json 可解析')
            return
        }
        if (!satisfiesCaret(REQUIRED, kernel.version)) {
            fail(`内核 ${kernel.name}@${kernel.version} 不满足 ${REQUIRED}`)
        }
    })
}
