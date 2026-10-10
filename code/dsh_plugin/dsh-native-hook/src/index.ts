/**
 * native hook 演示：一个普通的 Cordis 插件，直接订阅扩展点，不经过任何外部协议。
 *
 * 两个动作与桥接的 Claude Code hook 一一对照：
 *   1) `tools/pre-execute` 返回类型化 Decision，阻断危险 bash；
 *   2) `agent/session-start` 同步注入本会话的策略说明。
 *
 * 桥能给的是「复用已有的 hooks.json」和一对 `hook/*` 审计记录；换来的是
 * 事件清单、matcher 语义、`exit 2` 那条线协议的限制。这个插件把两者摆在一起，
 * 让取舍可见：它不写任何 `hook/*` 记录。
 *
 * @module dsh-native-hook
 */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

/** Cordis 插件名 */
export const name = 'dsh-native-hook'

/** 可配置项。 */
export interface Config {
    /** 命中即拒绝的命令正则源。用字符串数组，免得把 RegExp 写进 YAML。 */
    blockedCommands: string[]
    /** 拒绝时给模型看的原因。 */
    denyReason: string
    /** 会话开始时注入的说明；空字符串表示不注入。 */
    sessionNote: string
}

/**
 * 从一次工具调用里取出 bash 的命令行。
 *
 * @param exec - 本次工具调用。
 * @returns 命令行；不是 bash、或参数里没有 command 时返回 undefined。
 */
function bashCommandOf(exec: ToolExecution): string | undefined {
    if (exec.name !== 'bash') return undefined
    const args = exec.arguments as { command?: unknown } | undefined
    return typeof args?.command === 'string' ? args.command : undefined
}

/**
 * 装两个拦截点。
 *
 * @param ctx - 插件上下文。
 * @param config - 已解析的配置。
 */
export function apply(ctx: Context, config: Config): void {
    const patterns = config.blockedCommands.map(source => new RegExp(source))

    // 1) 危险命令：waterfall 返回类型化 Decision。
    //    走桥的同一个行为是「子进程 exit 2 + 往 stderr 写原因」；
    //    这里返回一个对象就完了，而且能换成 { kind: 'ask' } 去要一次审批。
    ctx.on('tools/pre-execute', (exec, next): PreToolDecision => {
        const command = bashCommandOf(exec)
        if (command === undefined) return next()
        if (!patterns.some(pattern => pattern.test(command))) return next()
        // 注意 native hook 不做参数改写：PreToolDecision 没有那条通道。
        return { kind: 'deny', reason: config.denyReason }
    })

    // 2) 会话开始：同步注入，所以第一个请求就带着它。
    //    桥的 SessionStart 是 detached 跑的，一个慢 hook 可能错过第一个请求
    //    （它的 README 把这条写进了已知限制，并留了一条 TODO）。
    //    另外：native hook 不写 hook/invoked、hook/result —— 要审计就自己在
    //    session/event 上折一份。
    ctx.on('agent/session-start', ({ agent }) => {
        if (config.sessionNote === '') return
        agent.inject(createUserMessage({
            content: [{ type: 'text', text: config.sessionNote }],
            source: { kind: 'plugin', plugin: name },
        }))
    })

    console.log(
        `[${name}] 已装：${patterns.length} 条阻断模式；`
        + `sessionNote=${config.sessionNote === '' ? '无' : '有'}`,
    )
}
