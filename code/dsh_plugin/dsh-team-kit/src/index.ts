/**
 * 团队装配包自带的插件：把团队约定写进每个会话的系统提示。
 *
 * 这个包的主体不是这段代码，而是同目录的 `cordis.patch.yml`——装进别人 profile
 * 的就是那一层。代码只补上 patch 表达不了的部分。
 *
 * @module dsh-team-kit
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// 只引入类型声明（module augmentation），编译后剥离
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'dsh-team-kit'

// 注册系统提示片段要等 systemPrompt 在。
export const inject = ['systemPrompt']

export interface Config {
    /** 追加到系统提示里的团队约定。 */
    conventions: string
}

export const Config: Schema<Config> = Schema.object({
    conventions: Schema.string().default(
        '提交信息用中文写，一次提交只做一件事。改动前先跑一遍相关测试。',
    ),
})

export function apply(ctx: Context, config: Config): void {
    // section 注册即 effect：重复的 name 会抛错，卸载时自动摘掉。
    // order 小的排在前面，这里给大值，让团队约定落在提示靠后的位置。
    ctx.systemPrompt.section({
        name: 'team:conventions',
        order: 900,
        text: config.conventions,
    })
}
