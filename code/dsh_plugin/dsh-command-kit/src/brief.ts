/**
 * `/brief`：一条把「贴图 + 一句话」变成一次模型工作的命令。
 *
 * 命令本身不产生模型消息——handler 的返回值只给 UI 看。要让模型动起来，
 * 得由 handler 自己把内容投递进会话；这里用 `agent.steer()`，与出厂的
 * `/plan` 同一个做法。
 *
 * 它同时演示附件准入：声明了 `input.attachments` 之后，executor 才会把
 * 用户贴的图片/文件落盘并交给 handler；没声明的命令收到附件会在 handler
 * 之前就变成 error。
 *
 * @module dsh-command-kit/brief
 */
import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import Schema from '@deepseek-ai/schemastery'

/** Cordis 插件名 */
export const name = 'command-kit-brief'

/** 命令注册表是必需的。 */
export const inject = ['commands']

/** 可配置项。 */
export interface Config {
    /** 交给模型的提示词前缀。 */
    instruction: string
    /** 是否接受输入框里贴的图片/文件。关掉之后附件会在 handler 之前被拒。 */
    acceptAttachments: boolean
}

/** Schemastery 校验：默认值写在这里，配置写错了在加载期就报，不等到第一次敲命令。 */
export const Config: Schema<Config> = Schema.object({
    instruction: Schema.string().default(
        '写一份单页简报，markdown 格式，开头用一级标题点明主题。写完调用 present 把它交付出来。',
    ),
    acceptAttachments: Schema.boolean().default(true),
})

/**
 * 注册 `/brief`。
 *
 * @param ctx - 插件上下文。
 * @param config - 已解析的配置。
 */
export function apply(ctx: Context, config: Config): void {
    ctx.commands.register({
        // adapter 认身份用；与展示文案、与每次执行的 commandId 都无关。
        definitionId: CommandDefinitionId('dsh-command-kit/brief'),
        name: 'brief',
        description: 'Draft a one-page brief for a topic (accepts pasted images)',
        // hint 只是给输入框看的占位符；attachments 才是准入开关。
        input: { hint: '<topic> [images]', attachments: config.acceptAttachments },
        // 模型侧那条 user message 已经带上了输入，日志里不必再存一份 args。
        recordInput: false,
        handler: ({ agent, rawInput, attachments }) => {
            // rawInput 从命令名后面第一个字符开始，带着分隔空白。
            const topic = rawInput.trim()
            if (topic === '' && attachments.length === 0) {
                return { kind: 'error', text: '用法：/brief <主题> [图片]' }
            }

            // 附件已经由 executor 落盘成 ImageBlock / FileBlock。
            // 它们是否、以什么顺序成为模型可见内容，由这一句决定。
            agent.steer(createUserMessage({
                content: [
                    ...attachments,
                    {
                        type: 'text',
                        text: `${config.instruction}\n\n主题：${topic === '' ? '（见所附图片）' : topic}`,
                    },
                ],
                source: { kind: 'user' },
            }))

            return {
                kind: 'success',
                text: `已把 ${topic === '' ? '图片' : `「${topic}」`} 交给模型（附件 ${attachments.length} 个）。`,
            }
        },
    })

    console.log(`[${name}] 已注册 /brief（附件：${config.acceptAttachments ? '接受' : '拒绝'}）`)
}
