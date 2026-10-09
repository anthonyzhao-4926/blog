/**
 * 启动计数落盘 + 按引用取密钥。
 *
 * 状态走 ctx.storageDomain：本插件自己声明一个 domain，数据落在
 * $DSH_HOME/storages/note_hits.json，不碰别人的 domain。
 *
 * 密钥只存引用：配置里写的是环境变量名，值由 ctx.credentials 的凭据库
 * （$DSH_HOME/.credentials.yaml）或进程环境提供；本插件从不把明文写进
 * 任何配置文件。
 *
 * 07 篇说过 ctx.logger 不往终端打，所以这里用 console 留证据。
 *
 * @module dsh-note-hits
 */
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import Schema from '@deepseek-ai/schemastery'
import { z } from 'zod'

export const name = 'dsh-note-hits'

/** domain 数据面是必需的；设置服务是可选依赖，用 ctx.inject 等它出现。 */
export const inject = ['storageDomain']

/** 全局单例槽：从没写过时读 initial，第一次 set 才落到介质上。 */
const bootState = z.object({
    boots: z.number().int().nonnegative(),
    lastAt: z.string(),
})

/**
 * 本插件独占的 domain。名字会变成落盘单元名，所以带前缀避免撞车；
 * version 变了读的时候对不上，得自己迁数据。本插件没有表，只用全局槽。
 */
const bootDomainSpec = defineDomain({
    name: 'note_hits',
    version: 1,
    global: {
        schema: bootState,
        initial: { boots: 0, lastAt: '' },
    },
    tables: {},
})

/** 可配置项：密钥只放引用，不放明文。 */
export interface Config {
    /** 取密钥用的凭据引用（环境变量名）。 */
    apiKeyEnv: string
}

export const Config: Schema<Config> = Schema.object({
    // role('credential-ref') 让设置页把它渲染成引用选择器，而不是密码框。
    apiKeyEnv: Schema.string().role('credential-ref').default('DEEPSEEK_API_KEY'),
})

/**
 * @param ctx - 插件上下文，必须已注入 storageDomain。
 * @param config - 已校验的配置。
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
    const domain = await ctx.storageDomain.open(bootDomainSpec)
    // 句柄归自己：插件卸载时先关 domain，别把单元漏在外面。
    ctx.effect(() => () => domain.close(), 'note-hits.domainClose')

    const state = domain.global.get()
    await domain.global.set({ boots: state.boots + 1, lastAt: new Date().toISOString() })
    console.log(`note-hits: 第 ${state.boots + 1} 次启动，状态落在 $DSH_HOME/storages/note_hits.json`)

    let current: () => Config = () => config

    /** 按引用取密钥：只打来源层和长度，永不打值。 */
    const reportCredential = async (): Promise<void> => {
        const ref = credentialRef(current().apiKeyEnv)
        const credentials = ctx.get('credentials')
        if (credentials === undefined) {
            console.warn(`note-hits: 没有凭据服务，${ref} 只能靠进程环境`)
            return
        }
        const info = await credentials.describe(ref)
        if (!info.configured) {
            console.warn(`note-hits: ${ref} 还没配（可在设置页填，或导出环境变量）`)
            return
        }
        const resolved = await credentials.resolve(ref)
        console.log(
            `note-hits: ${ref} 来自 ${resolved?.source ?? 'unknown'} 层，`
            + `值长 ${resolved?.value.length ?? 0} 个字符（值本身不打）`,
        )
    }

    // 设置服务在，就挂一个同名 namespace：页面改完引用，这里立刻重报一次。
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.installSection(ctx, 'note-hits', Config, config, {
            setSource: (source) => {
                current = source
            },
            onChange: () => void reportCredential(),
        })
    })

    await reportCredential()
}
