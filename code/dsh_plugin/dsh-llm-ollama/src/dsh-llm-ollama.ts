/**
 * 接本地 Ollama：把 DSH 的消息与流协议翻译成 OpenAI 兼容的 HTTP 请求。
 *
 * 08 篇讲过 LLM 这一层是三件套——`ctx.llm` 是服务定义，agent loop 是消费者，
 * 本插件补上第三个角色：提供方。它只做两件翻译：provider-neutral 的请求变成
 * Ollama 认识的 JSON，Ollama 的 SSE 分片变回 `StreamChunk`。
 *
 * @module dsh-llm-ollama
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import {
    attributionHeaders,
    EMPTY_RESPONSE_CODE,
    LlmAdapter,
    LlmError,
    ToolCallId,
} from '@deepseek-ai/dsh-llm'
import type {
    FinishReason,
    GenerateOptions,
    LlmFailure,
    LlmModelInfo,
    LlmProviderInfo,
    StreamChunk,
    TextBlock,
    TokenUsage,
    ToolCallBlock,
    ToolSchema,
} from '@deepseek-ai/dsh-llm'

export const name = 'dsh-llm-ollama'

// 注册 adapter 走 ctx.llm；没有这个服务，插件没有意义。
export const inject = ['llm']

export interface Config {
    /** 本 adapter 占用的 provider 路由名；会话的 provider 字段按它匹配。 */
    provider: string
    /** OpenAI 兼容端点前缀；Ollama 默认在 11434 端口暴露 `/v1`。 */
    baseURL: string
    /** 对外 advertise 的模型名，只影响选择器，不限制实际能请求的模型。 */
    models: string[]
}

export const Config: Schema<Config> = Schema.object({
    provider: Schema.string().default('ollama'),
    baseURL: Schema.string().default('http://127.0.0.1:11434/v1'),
    models: Schema.array(Schema.string()).default([]),
})

export function apply(ctx: Context, config: Config): void {
    // 注册本身就是 effect：卸载、重载、被 patch 停用时路由跟着摘掉。
    ctx.llm.registerAdapter([config.provider], new OllamaAdapter(config))
    console.log(`[${name}] provider "${config.provider}" 已接上 ${config.baseURL}`)
}

class OllamaAdapter extends LlmAdapter {
    constructor(private readonly config: Config) {
        super()
    }

    override providerInfo(provider: string): LlmProviderInfo {
        return { id: provider, name: 'Ollama（本地）' }
    }

    /** 选择器里列出来的模型。列表是建议性的：列表外的模型名照样能请求。 */
    override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
        return this.config.models.map(id => ({ provider, id, name: id }))
    }

    async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        const response = await fetch(`${this.config.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                // adapter 契约的一条：每个 provider 请求都带上应用标识头。
                ...attributionHeaders(),
            },
            body: JSON.stringify({
                model: options.model,
                messages: toWireMessages(options),
                stream: true,
                // 不加这个，OpenAI 兼容端点不会在流末尾补一个 usage 分片。
                stream_options: { include_usage: true },
                ...options.tools === undefined ? {} : { tools: toWireTools(options.tools) },
                ...options.temperature === undefined ? {} : { temperature: options.temperature },
                ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
                ...options.stop === undefined ? {} : { stop: options.stop },
            }),
            signal: options.signal,
        })

        if (!response.ok || response.body === null) {
            // 传输与协议错误走 throw 这条路；provider 在流里报的错走 finish。
            throw new LlmError(
                `Ollama 请求失败：HTTP ${response.status} ${await response.text()}`,
                'TRANSPORT',
                { status: response.status },
            )
        }

        yield* translate(response.body)
    }
}

/** 一条 OpenAI 兼容的 wire 消息。 */
interface WireMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_calls?: {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
    }[]
    tool_call_id?: string
}

/** 一个 OpenAI 兼容的流式分片，只留本篇用得到的字段。 */
interface WireChunk {
    choices?: {
        delta?: {
            content?: string
            reasoning_content?: string
            tool_calls?: {
                index: number
                id?: string
                function?: { name?: string; arguments?: string }
            }[]
        }
        finish_reason?: string
    }[]
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
    }
    error?: { message?: string; type?: string; code?: string }
}

/** provider 的 finish_reason 到 provider-neutral 结束原因的映射。 */
const FINISH_REASONS: Record<string, FinishReason> = {
    'stop': { kind: 'stop' },
    'tool_calls': { kind: 'tool-calls' },
    'length': { kind: 'max-tokens' },
}

/**
 * 把 DSH 的消息翻译成 wire 消息。
 *
 * 一处不对称：助手消息能把多个工具调用装在同一条消息里，工具结果却必须一条
 * 结果一条消息——所以一条带 N 个 tool-result 的用户消息会拆成 N 条。图片块与
 * 文件块本篇不翻译，直接跳过（见「注意事项」）。
 */
function toWireMessages(options: GenerateOptions): WireMessage[] {
    const wire: WireMessage[] = []
    if (options.system !== undefined && options.system !== '') {
        wire.push({ role: 'system', content: options.system })
    }

    for (const message of options.messages) {
        const text = textOf(message.content)
        if (message.role === 'assistant') {
            const calls = message.content.filter((block): block is ToolCallBlock => block.type === 'tool-call')
            wire.push({
                role: 'assistant',
                content: text,
                ...calls.length === 0 ? {} : {
                    tool_calls: calls.map(call => ({
                        id: String(call.id),
                        type: 'function' as const,
                        function: { name: call.name, arguments: call.arguments },
                    })),
                },
            })
            continue
        }
        if (message.role === 'system') {
            if (text !== '') wire.push({ role: 'system', content: text })
            continue
        }
        for (const block of message.content) {
            if (block.type !== 'tool-result') continue
            wire.push({ role: 'tool', tool_call_id: String(block.toolCallId), content: textOf(block.content) })
        }
        if (text !== '') wire.push({ role: 'user', content: text })
    }
    return wire
}

/** 工具定义进 wire 时要包一层 `function`，其余字段原样。 */
function toWireTools(tools: readonly ToolSchema[]): unknown[] {
    return tools.map(tool => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }))
}

/** 取一组内容块里的文本，忽略非文本块。 */
function textOf(blocks: readonly { type: string }[]): string {
    return blocks
        .filter((block): block is TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('')
}

/** 正在流的文本块或推理块。 */
interface OpenText {
    index: number
    text: string
}

/** 正在流的一次工具调用。 */
interface OpenToolCall {
    index: number
    id: string
    name: string
    args: string
}

/**
 * 把 SSE 字节流翻译成 `StreamChunk`。
 *
 * 三条契约在这里落地：块用 `index` 关联（文本、推理、每次工具调用各占一个块，
 * 由我们自己编号）；`usage` 必须在 `finish` 之前；`finish` 之后不再产出任何
 * 东西——所以块结束事件统一推迟到收尾，而不是在分片里零散地发。
 */
async function* translate(body: ReadableStream<Uint8Array>): AsyncIterable<StreamChunk> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let nextIndex = 0
    let text: OpenText | undefined
    let reasoning: OpenText | undefined
    const toolCalls = new Map<number, OpenToolCall>()
    let usage: TokenUsage | undefined
    let failure: LlmFailure | undefined
    let reason: FinishReason = { kind: 'stop' }

    /** 处理一个分片，返回它带来的 chunk。 */
    function handle(chunk: WireChunk): StreamChunk[] {
        const out: StreamChunk[] = []
        const choice = chunk.choices?.[0]
        const delta = choice?.delta

        if (delta?.reasoning_content) {
            reasoning ??= { index: nextIndex++, text: '' }
            if (reasoning.text === '') {
                out.push({ type: 'block-start', index: reasoning.index, blockType: 'reasoning' })
            }
            reasoning.text += delta.reasoning_content
            out.push({ type: 'reasoning-delta', index: reasoning.index, text: delta.reasoning_content })
        }

        if (delta?.content) {
            text ??= { index: nextIndex++, text: '' }
            if (text.text === '') {
                out.push({ type: 'block-start', index: text.index, blockType: 'text' })
            }
            text.text += delta.content
            out.push({ type: 'text-delta', index: text.index, text: delta.content })
        }

        for (const call of delta?.tool_calls ?? []) {
            let open = toolCalls.get(call.index)
            if (open === undefined) {
                // id 与函数名只出现在第一个分片里，后面的分片只带参数增量。
                open = {
                    index: nextIndex++,
                    id: call.id ?? `call_${call.index}`,
                    name: call.function?.name ?? '',
                    args: '',
                }
                toolCalls.set(call.index, open)
                out.push({ type: 'block-start', index: open.index, blockType: 'tool-call' })
            }
            const argumentsDelta = call.function?.arguments ?? ''
            open.args += argumentsDelta
            out.push({
                type: 'tool-call-delta',
                index: open.index,
                id: ToolCallId(open.id),
                name: open.name,
                argumentsDelta,
            })
        }

        if (chunk.usage !== undefined) {
            usage = {
                inputTokens: chunk.usage.prompt_tokens ?? 0,
                outputTokens: chunk.usage.completion_tokens ?? 0,
                ...chunk.usage.total_tokens === undefined ? {} : { totalTokens: chunk.usage.total_tokens },
            }
        }

        if (chunk.error !== undefined) {
            failure = { message: chunk.error.message ?? 'Ollama 流内错误', code: chunk.error.code ?? 'PROVIDER_ERROR' }
        }

        if (choice?.finish_reason != null && choice.finish_reason !== '') {
            reason = FINISH_REASONS[choice.finish_reason] ?? { kind: 'stop' }
        }
        return out
    }

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let cut = buffer.indexOf('\n')
            while (cut !== -1) {
                const line = buffer.slice(0, cut).trim()
                buffer = buffer.slice(cut + 1)
                cut = buffer.indexOf('\n')
                if (!line.startsWith('data:')) continue
                const payload = line.slice('data:'.length).trim()
                if (payload === '' || payload === '[DONE]') continue
                yield* handle(JSON.parse(payload) as WireChunk)
            }
        }
    } finally {
        reader.releaseLock()
    }

    if (reasoning !== undefined) {
        yield { type: 'block-end', index: reasoning.index, block: { type: 'reasoning', text: reasoning.text } }
    }
    if (text !== undefined) {
        yield { type: 'block-end', index: text.index, block: { type: 'text', text: text.text } }
    }
    for (const open of toolCalls.values()) {
        yield {
            type: 'block-end',
            index: open.index,
            block: { type: 'tool-call', id: ToolCallId(open.id), name: open.name, arguments: open.args },
        }
    }
    if (usage !== undefined) yield { type: 'usage', usage }

    if (failure !== undefined) {
        yield { type: 'finish', reason: { kind: 'error', failure } }
        return
    }

    // 正常结束却一个块都没有，是可重试的 EMPTY_RESPONSE，不是静默的成功。
    const empty = text === undefined && reasoning === undefined && toolCalls.size === 0
    if (reason.kind === 'stop' && empty) {
        yield {
            type: 'finish',
            reason: {
                kind: 'error',
                failure: { message: 'Ollama 返回了空补全', code: EMPTY_RESPONSE_CODE },
            },
        }
        return
    }

    yield { type: 'finish', reason }
}
