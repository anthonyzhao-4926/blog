/**
 * 把 DSH 真实派发过的事件按发生顺序打出来。
 *
 * 这不是"事件清单"，是"事件时刻表"：不聚合、不计数，只在每个事件发生时
 * 落一行，用来看谁在谁之前——也就是生命周期。
 *
 * 本插件没有任何作用域标签（不在任何 agent 的 ctx 里注册），按 scope 的规则会收到
 * 全部 agent 的事件：看到的是整进程。
 *
 * 关于类型：每个事件的名字与参数都由声明它的包登记进 Cordis 的 Events 总表，
 * 所以 ctx.on 的那一刻就有类型。中间那些 interface 只是把 payload 的形状抄出来，
 * 不导出、也不依赖那些包——真要用到完整类型，把声明事件的包（@deepseek-ai/dsh-agent、
 * -llm、-subagent、-workflow）加进 dependencies 即可。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-approval'

export const name = 'dsh-event-timeline'

/** `agent/*` 事件 payload 里带的那个 agent。 */
interface AgentRef {
    readonly id: string
}

/** `agent/status` 的取值。 */
type AgentStatus = 'idle' | 'running'

/** `agent/session-start` 的来源。 */
type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'

/** `agent/pre-step` 里 `next()` 的返回值：进入这一步，或者拒绝。 */
type PreStepDecision = { kind: 'reject' } | { kind: 'enter'; messages: unknown[] }

/** `agent/request` 里 `next()` 的返回值：冻结的那次模型调用配置。 */
interface LlmCallConfig {
    provider: string
    model: string
}

/** `subagent/start` / `subagent/end` 的 payload。 */
interface SubagentRunInfo {
    readonly runId: string
    readonly provider: string
    readonly id: string
}

/** `workflow/start` / `workflow/end` 的 payload。 */
interface WorkflowRunInfo {
    readonly id: string
    readonly meta: { readonly name: string }
}

/** `internal/dispatch` 带过来的分发模式。 */
type DispatchMode = 'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall'

/**
 * 只看这些 harness 事件。不加白名单，启动阶段就会被上百条 internal/* 刷屏；
 * system-prompt/change 这类无参广播跟一轮对话的节奏无关，也一并挡在外面。
 */
const WATCHED = new Set([
    'agent/created', 'agent/disposed', 'agent/session-start', 'agent/status',
    'agent/inbox/inserted', 'agent/inbox/claimed', 'agent/inbox/discarded',
    'agent/pre-step', 'agent/request', 'agent/request-error',
    'agent/turn-stopping', 'agent/error',
    'session/created', 'session/disposed', 'session/flush',
    'system-prompt/assemble', 'llm/stream',
    'tools/pre-execute', 'tools/execute', 'tools/post-execute', 'tools/result',
    'approval/request',
    'subagent/start', 'subagent/end',
    'workflow/start', 'workflow/phase', 'workflow/end',
])

/**
 * 会话日志记录类型白名单。
 *
 * 这些**不是** Cordis 事件，是 `session/event` 里 `event.type` 的取值（见
 * `SessionEventMap`）。放在同一张时间线上看，才知道"记录"紧跟在哪个"事件"后面。
 */
const RECORDED = new Set([
    'turn/start', 'turn/end', 'step/start', 'step/end',
    'user/message', 'assistant/message', 'assistant/attempt',
    'tool/call', 'tool/result', 'approval/decided', 'goal/change',
])

export function apply(ctx: Context): void {
    const startedAt = Date.now()

    /** 相对启动的毫秒，右对齐到 6 位，方便竖着扫。 */
    const at = (): string => `+${String(Date.now() - startedAt).padStart(6, ' ')}ms`
    const say = (line: string): void => { console.log(`[${name}] ${at()} ${line}`) }

    // ① 插件树：fiber 建立时 uid 有值，销毁时已被清空 —— 同一个事件名，两种含义。
    ctx.on('internal/plugin', (fiber) => {
        say(`internal/plugin  ${fiber.uid === null ? 'dispose' : 'create '}  ${fiber.name ?? '匿名'}`)
    })

    // 每次派发之前触发一次，带 (mode, name, args, thisArg)。
    // 这是排查用的快照钩子，不是 harness 事件，别留在长期代码里。
    ctx.on('internal/dispatch', (mode, eventName, args, thisArg) => {
        if (!WATCHED.has(eventName)) return
        const scope = thisArg === null ? '无（不过滤）' : '有作用域'
        say(`dispatch  ${String(mode as DispatchMode).padEnd(9)} ${eventName}  this=${scope}  args=${args.length}`)
    })

    // ② agent 生命周期。监听器收到的就是 payload；agent 主体在 payload.agent 上。
    ctx.on('agent/created', ({ agent }: { agent: AgentRef }) => {
        say(`→ agent/created        agent=${agent.id}`)
    })
    ctx.on('agent/disposed', ({ agent }: { agent: AgentRef }) => {
        say(`→ agent/disposed       agent=${agent.id}`)
    })
    ctx.on('agent/session-start', ({ agent, source }: { agent: AgentRef; source: SessionStartSource }) => {
        say(`→ agent/session-start  agent=${agent.id} source=${source}`)
    })
    ctx.on('agent/status', ({ agent, status }: { agent: AgentRef; status: AgentStatus }) => {
        say(`→ agent/status         agent=${agent.id} → ${status}`)
    })
    ctx.on('agent/inbox/inserted', ({ agent, message }: { agent: AgentRef; message: { role: string } }) => {
        say(`→ inbox/inserted       agent=${agent.id} role=${message.role}`)
    })
    ctx.on('agent/inbox/claimed', ({ agent, message, turn }: { agent: AgentRef; message: { role: string }; turn: number }) => {
        say(`→ inbox/claimed        agent=${agent.id} turn=${turn} role=${message.role}`)
    })
    ctx.on('agent/inbox/discarded', ({ agent, message }: { agent: AgentRef; message: { role: string } }) => {
        say(`→ inbox/discarded      agent=${agent.id} role=${message.role}`)
    })

    // 管道：包住一次调用，看"前 / 后"两个时刻。必须调 next()；结果原样返回。
    ctx.on('agent/pre-step', async (payload: { turn: number; step: number }, next: () => Promise<PreStepDecision>) => {
        say(`→ pre-step 进入        turn=${payload.turn} step=${payload.step}`)
        const decision = await next()
        say(`→ pre-step 出来        ${decision.kind}`)
        return decision
    })
    ctx.on('agent/request', async (_payload: unknown, next: () => Promise<LlmCallConfig>) => {
        const config = await next()
        say(`→ request              provider=${config.provider} model=${config.model}`)
        return config
    })
    ctx.on('agent/request-error', async (payload: { failure: unknown }, next: () => Promise<unknown>) => {
        say(`→ request-error        ${String(payload.failure)}`)
        return next()
    })
    ctx.on('agent/turn-stopping', ({ turn }: { turn: number }) => {
        say(`→ turn-stopping        turn=${turn}（可在此 steer）`)
    })
    ctx.on('agent/error', ({ error }: { error: unknown }) => {
        say(`→ agent/error          ${String(error)}`)
    })

    // ③ 会话与模型：session/* 是事件；turn/* step/* 要从 session/event 里认。
    ctx.on('session/created', (session) => { say(`■ session/created      ${session.id}`) })
    ctx.on('session/disposed', (session) => { say(`■ session/disposed     ${session.id}`) })
    ctx.on('session/flush', (session) => { say(`■ session/flush        ${session.id}`) })

    ctx.on('session/event', (session, event) => {
        if (!RECORDED.has(event.type)) return
        say(`· 记录 ${event.type.padEnd(18)} ${session.id}`)
    })

    ctx.on('llm/stream', (_options: { model?: string }, next: () => unknown) => {
        say('→ llm/stream           （包住这一次流式调用）')
        return next()
    })

    // ④ 工具与子流程：工具执行是四步管线，不是一步。
    ctx.on('tools/pre-execute', async (exec, next) => {
        const decision = await next()
        say(`▲ tools/pre-execute    ${exec.name} → ${String((decision as { kind?: string }).kind ?? 'ok')}`)
        return decision
    })
    ctx.on('tools/execute', async (exec, next) => {
        say(`▲ tools/execute 进     ${exec.name}`)
        try {
            return await next()
        } finally {
            say(`▲ tools/execute 出     ${exec.name}`)
        }
    })
    ctx.on('tools/post-execute', async (_exec, _result, next) => {
        const decision = await next()
        say('▲ tools/post-execute   （结果被接受 / 改写 / 拦掉）')
        return decision
    })
    ctx.on('tools/result', (exec, result) => {
        say(`▲ tools/result         ${exec.name} ${result.isError ? '失败' : '成功'}`)
    })

    // 审批：返回值即"认领"，不返回就委派给下一个监听器 / 内置行为。
    ctx.on('approval/request', async (_req, next) => {
        say('▲ approval/request     需要人拍板')
        const outcome = await next()
        say(`▲ approval/request 出  ${String(outcome)}`)
        return outcome
    })

    // 子代理与编排：start / end 成对，phase 夹在中间。
    ctx.on('subagent/start', (info: SubagentRunInfo) => { say(`◆ subagent/start       ${info.provider}`) })
    ctx.on('subagent/end', (info: SubagentRunInfo) => { say(`◆ subagent/end         ${info.provider}`) })
    ctx.on('workflow/start', (info: WorkflowRunInfo) => { say(`◆ workflow/start       ${info.meta.name}`) })
    ctx.on('workflow/phase', (_info: WorkflowRunInfo, title: string) => { say(`◆ workflow/phase       ${title}`) })
    ctx.on('workflow/end', (info: WorkflowRunInfo) => { say(`◆ workflow/end         ${info.meta.name}`) })
}
