/**
 * 往系统提示词里加一段自己的规矩。
 *
 * 系统提示词不是一整块写死的文本，而是「各贡献方先注册段落、组装时按 order
 * 拼起来」。所以插件要说规矩，做的事不是拼字符串，而是注册一段。
 *
 * 两个容易踩的点在这个 demo 里都能看到：
 * - 段落名必须唯一，重复注册会抛错；
 * - 相同 order 的段落按「名称的代码单元顺序」排，所以别指望注册顺序决定先后。
 *
 * @module dsh-prompt-lab
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：ctx.systemPrompt 的 Context 合并与段落类型。
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'dsh-prompt-lab'

/** systemPrompt 是本插件存在的理由；prompt 段落注册在它的注册表上。 */
export const inject = ['systemPrompt']

/** 本插件那一段的名字：全局唯一，重复注册会抛错。 */
const SECTION_NAME = 'lab:repo-conventions'

/**
 * 本段的文本。可以是个函数——每次组装时按当前的组装上下文求值，
 * 所以能读到「这次是哪个 agent、这次请求带没带取消信号」这类信息。
 * @param context - 本次组装的上下文。
 * @returns 这段时间要注入的文本。
 */
function render(context: { agent?: unknown }): string {
    // 动态求值的用处：内容可以随组装上下文变。这里只是把有没有 agent 写出来。
    const binding = context.agent === undefined ? '（没有绑定 agent）' : '（已绑定到一个 agent）'
    return [
        `本仓库的约定${binding}：`,
        '- 新增的文档放在 docs/ 下，按主题分目录；',
        '- 提交信息用祈使句，一行说清改了什么；',
        '- 改完代码跑一次 lint，不要让格式问题混进提交。',
    ].join('\n')
}

export function apply(ctx: Context): void {
    // 注册本身就是 effect：卸载时这一段跟着消失。
    //
    // order 决定它拼在哪儿——数字小的在前。这里取 900，
    // 落在「仓库自己的规矩」那一段区间里，靠后但不至于挤掉收尾段。
    ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: 900,
        text: render,
    })

    // 顺带说一句：这段文本最终是作为会话里的 system/message 表面节点到达模型的，
    // 不是请求里的一个字段。所以它能被历史、压缩、回放这些机制正常处理。
}
