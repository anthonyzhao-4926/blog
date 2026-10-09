/**
 * 一条 webhook 规则：外部交付进来，判断要不要开个会话去处理它。
 *
 * 这条缝最常见的误解是「它像消息队列」。它不是：dispatch 会在任何回调
 * 结算之前就返回，runtime 没有队列、没有重试、没有去重、没有执行状态。
 * 所以重复交付可能开出重复的会话——要防重，得你自己在规则里做。
 *
 * 规则拿到的交付已经被验证、分离并冻结过了；但「已签名」只保证它是个
 * 无损 JSON 对象，**事件里具体哪些字段有用、值合不合理，是规则的活**。
 *
 * @module dsh-webhook-lab
 */
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：ctx.webhookRuntime 的 Context 合并，以及交付与请求类型。
import type {} from '@deepseek-ai/dsh-webhook'
import type {} from '@deepseek-ai/dsh-webhook-github'

export const name = 'dsh-webhook-lab'

/** webhookRuntime 是这条缝的运行时；没有它本插件不启动。 */
export const inject = ['webhookRuntime']

/** 这条规则的唯一 id。 */
const RULE_ID = 'lab-issue-opened'

/**
 * 判断这是不是一个「新开了 issue」的交付。
 * @param delivery - runtime 分发的已验签交付。
 * @returns 事件编号与标题；不是我们要的事件时返回 undefined。
 */
function readIssueOpened(delivery: { event: unknown }): { number: number, title: string } | undefined {
    const event = delivery.event as {
        action?: unknown
        issue?: { number?: unknown, title?: unknown }
    }
    // 规则负责校验自己消费的事件特定字段——runtime 只保证它是无损 JSON。
    if (event.action !== 'opened') return undefined
    if (typeof event.issue?.number !== 'number' || typeof event.issue.title !== 'string') return undefined
    // 标题是人写的，掏空它是为了只留一句可读的提示词素材。
    const title = event.issue.title.trim()
    if (title === '') return undefined
    return { number: event.issue.number, title }
}

export function apply(ctx: Context): void {
    // register 本身就是 effect：注销时会先移除规则，再中止并排空本规则的活动调用，
    // 所以后续交付不会进到正在卸载的代码里。
    ctx.effect(() => ctx.webhookRuntime.register({
        id: RULE_ID,
        kind: 'github',
        run: (delivery, signal) => {
            const issue = readIssueOpened(delivery)
            // 返回 null 表示「这条交付我不管」，runtime 不会做任何事。
            if (issue === undefined) return null

            // 异步工作如果应该在注销时停下，就必须自己观察 signal。
            if (signal.aborted) return null

            // 非 null 的结果 = 请 runtime 开一个会话去处理它。
            return {
                workspacePath: process.cwd(),
                title: `Issue #${issue.number}: ${issue.title}`,
                prompt: `仓库里新开了一个 issue：${issue.title}。去看一眼相关代码，给出处理建议。`,
                agentPreset: 'default',
                permissionPreset: 'default',
            }
        },
    }), 'dsh-webhook-lab: rule')
}
