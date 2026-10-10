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
// WebhookRuleId 是运行时的品牌工厂：规则 id 是不透明字符串，不能直接写裸字符串。
import { WebhookRuleId } from '@deepseek-ai/dsh-webhook'
// 只引入类型声明：GitHub 适配器规范化后的事件类型（WebhookEventMap 的合并）。
import type {} from '@deepseek-ai/dsh-webhook-github'

export const name = 'dsh-webhook-lab'

/** webhookRuntime 是这条缝的运行时；没有它本插件不启动。 */
export const inject = ['webhookRuntime']

/** 这条规则的唯一 id。 */
const RULE_ID = WebhookRuleId('lab-issue-opened')

/**
 * 判断这是不是一个「新开了 issue」的交付。
 * @param delivery - runtime 分发的已验签交付。
 * @returns 事件编号与标题；不是我们要的事件时返回 undefined。
 */
function readIssueOpened(delivery: { event: unknown }): { number: number, title: string } | undefined {
    // GitHub 适配器把事件规范化成 { name, payload }：name 是 X-GitHub-Event 的名字，
    // payload 是验签后的原始 JSON 对象。具体字段的校验是规则的活。
    const { name, payload } = delivery.event as {
        name?: unknown
        payload?: { action?: unknown, issue?: { number?: unknown, title?: unknown } }
    }
    // 规则负责校验自己消费的事件特定字段——runtime 只保证它是无损 JSON。
    if (name !== 'issues') return undefined
    if (payload === undefined || payload.action !== 'opened') return undefined
    if (typeof payload.issue?.number !== 'number' || typeof payload.issue.title !== 'string') return undefined
    // 标题是人写的，掏空它是为了只留一句可读的提示词素材。
    const title = payload.issue.title.trim()
    if (title === '') return undefined
    return { number: payload.issue.number, title }
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
            // agentPreset / permissionPreset 必须是这个 profile 里真实注册过的 id。
            return {
                workspacePath: process.cwd(),
                title: `Issue #${issue.number}: ${issue.title}`,
                prompt: `仓库里新开了一个 issue：${issue.title}。去看一眼相关代码，给出处理建议。`,
                agentPreset: 'standard',
                permissionPreset: 'read-only',
            }
        },
    }), 'dsh-webhook-lab: rule')
}
