/**
 * 一个最小的 SDK 客户端：起一个 dsh 子进程，发一条提示词，读回事件。
 *
 * 这里刻意不用 @deepseek-ai/dsh-sdk-client，而是手写协议帧——因为协议本身
 * 很朴素：JSON-RPC，按换行分帧。手写一遍能看清「从外面驱动」到底发生了什么：
 * 你启动的是一个真正的 dsh 进程（带具名 profile），然后跟它对话。
 *
 * 用法：node client.mjs "你的提示词"
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const prompt = process.argv[2] ?? '用一句话说明你现在跑在哪个 profile 上。'

// sdk profile = base 组合 + SDK 的 JSON-RPC stdio 服务器。
// 换成 headless 就是一次性任务应用，换成 acp 就是 ACP 服务器。
const child = spawn('dsh', ['--profile', 'sdk'], { stdio: ['pipe', 'pipe', 'inherit'] })

/** 按换行分帧的 JSON-RPC：一行一条消息。 */
function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`)
}

let nextId = 1
const pending = new Map()

const lines = createInterface({ input: child.stdout })
lines.on('line', (line) => {
    if (line.trim() === '') return
    let message
    try {
        message = JSON.parse(line)
    } catch {
        console.error('[无法解析的行]', line)
        return
    }

    // 有 id 且我们发过它 → 这是一条响应。
    if (message.id !== undefined && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id)
        pending.delete(message.id)
        if (message.error === undefined) resolve(message.result)
        else reject(new Error(`RPC 失败：${JSON.stringify(message.error)}`))
        return
    }

    // 没有 id → 这是服务器推来的通知。会话事件、agent 状态变化都走这条路。
    if (message.method !== undefined) {
        console.log('[通知]', message.method, JSON.stringify(message.params ?? {}).slice(0, 200))
    }
})

/** 发一条请求并等它的响应。 */
function request(method, params) {
    const id = nextId++
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        send({ jsonrpc: '2.0', id, method, params })
    })
}

try {
    const opened = await request('session/open', {})
    const sessionId = opened?.sessionId ?? opened?.id
    console.log('[已开会话]', sessionId)

    await request('session/prompt', { sessionId, content: [{ type: 'text', text: prompt }] })
    console.log('[提示词已发送，等事件…]')

    // 真实客户端会在这里等一个「轮次结束」的通知再收尾；这个最小版本给一段观察窗口。
    await new Promise((resolve) => setTimeout(resolve, 15000))
} catch (error) {
    console.error('[出错]', error.message)
} finally {
    child.kill('SIGTERM')
}
