/**
 * 工具守卫：在执行前拦下两类调用——
 *   1. write / edit 把文件写到工作区之外；
 *   2. bash 里的危险命令（sudo、rm -rf / 之类）。
 *
 * 拦截点是 `ctx.tools.guard()`：同步、单调——返回一个字符串就是最终拒绝，
 * 没有任何监听器顺序能把它翻回允许。这个字符串会成为模型看到的工具失败
 * 原因（`Error: <理由>`），所以理由要写给模型看：哪里错了、正确的做法
 * 是什么。
 *
 * @module dsh-tool-guard
 */
import nodePath from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-tool-guard'

// guard 挂在 ctx.tools 上，tools 是硬依赖：没有它这个插件没有意义。
export const inject = ['tools']

/**
 * 危险 bash 命令的黑名单：模式 + 给模型看的理由。
 * 这是演示用的最小集合，不是完备的安全边界（见文章「注意事项」）。
 */
const DANGEROUS_COMMANDS: readonly { pattern: RegExp; reason: string }[] = [
    {
        pattern: /\bsudo\b/,
        reason: '命令包含 sudo：提权操作不被允许。请改用不需要 root 权限的做法；确实需要时，把命令告诉我，由我自己执行。',
    },
    {
        pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\/(\s|$)/,
        reason: '这条 rm 以根目录 / 为目标：递归删除会毁掉整台机器。请把目标改成工作区内的具体路径。',
    },
    {
        pattern: /\b(mkfs|fdisk)\b|\bdd\b[^|;&]*\bof=\/dev\//,
        reason: '这条命令直接操作磁盘设备或分区，可能造成不可逆的数据丢失，一律拒绝。',
    },
    {
        pattern: /\b(shutdown|reboot|halt|poweroff)\b/,
        reason: '关机 / 重启不在你的权限范围内。请继续完成手头的任务。',
    },
]

export function apply(ctx: Context): void {
    // guard() 和 ctx.on 一样，注册本身就是一次 effect：插件卸载、重载、
    // 被 patch 停用时守卫跟着摘掉，不用自己记账。
    ctx.tools.guard(exec => checkWritePath(exec) ?? checkBashCommand(exec))
    console.log(`[${name}] 守卫已就位：工作区外写入、危险 bash 命令`)
}

/** 写文件类工具的路径检查：解析后的绝对路径必须落在工作区里。 */
function checkWritePath(exec: Readonly<ToolExecution>): string | undefined {
    if (exec.name !== 'write' && exec.name !== 'edit') return undefined
    const filePath = stringArg(exec.arguments, 'file_path')
    if (filePath === undefined) return undefined
    const root = workspaceRoot(exec)
    const resolved = nodePath.resolve(root, filePath)
    if (resolved === root || resolved.startsWith(root + nodePath.sep)) return undefined
    return `路径 ${filePath} 在工作区（${root}）之外。请把文件写到工作区内部；确实需要写外部路径时，先向我说明原因。`
}

/** bash 命令检查：命中黑名单就拒绝，理由写给模型看。 */
function checkBashCommand(exec: Readonly<ToolExecution>): string | undefined {
    if (exec.name !== 'bash') return undefined
    const command = stringArg(exec.arguments, 'command')
    if (command === undefined) return undefined
    for (const { pattern, reason } of DANGEROUS_COMMANDS) {
        if (pattern.test(command)) return reason
    }
    return undefined
}

/** 这次调用的工作区根：会话的 cwd；拿不到（无 agent 的调用）就退到进程 cwd。 */
function workspaceRoot(exec: Readonly<ToolExecution>): string {
    return exec.agent?.session.header.cwd ?? process.cwd()
}

/**
 * 从模型给的参数里取一个字符串字段。guard 跑在工具自己的参数校验之前，
 * arguments 是不可信的 JSON：不是对象、字段不是字符串，都当没看见，
 * 留给工具自己的校验去报错。
 */
function stringArg(args: unknown, key: string): string | undefined {
    if (typeof args !== 'object' || args === null) return undefined
    const value = (args as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : undefined
}
