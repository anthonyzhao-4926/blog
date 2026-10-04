/**
 * 聊天背景插件（设置页版）的 Host 半：注册图片路由、往页面注入样式。
 *
 * 与 06 篇的 dsh-chat-background-config 是同一个插件，差别只有一处：两个
 * 配置字段声明成 .volatile()。volatile 字段会被设置服务投影成设置页上的
 * 表单项（namespace 就是 profile 里这一行的 entry id），同事在界面上改，
 * 不碰 cordis.yml；写入后 Loader 做 volatile 提交，不重启本插件，新值直接
 * 进入运行中的引用。
 *
 * 这个文件跑在 Node 里（Host 进程）；浏览器里的设置页在 src/client/ 下。
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// 只引入类型声明：loader/volatile-update 的事件类型由 loader 包合并进来。
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-chat-background-settings'

// 默认图是包内自带的 svg；同事在设置页填自己图片的绝对路径来覆盖它。
const DEFAULT_IMAGE = new URL('../image.svg', import.meta.url).pathname
// 路由地址不含扩展名：图片路径可配，Content-Type 按配置里那个文件的扩展名走。
const IMAGE_URL = '/dsh-chat-background-settings/image'

/** 允许的图片扩展名 → Content-Type。 */
const CONTENT_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
}

export interface Config {
    /** 背景图片的绝对路径。 */
    image: Volatile<string>
    /** 图片显示强度：0 完全透明，1 完全不透明。 */
    opacity: Volatile<number>
}

export const Config: Schema<Config> = Schema.object({
    image: Schema.string().default(DEFAULT_IMAGE).volatile(),
    opacity: Schema.number().min(0).max(1).default(0.35).volatile(),
})

export function apply(ctx: Context, config: Config): void {
    // volatile 字段拿到的是稳定引用，读 .get() 永远是最新值：
    // 路由每次请求读一次，设置页保存后的下一次请求就用新图。
    ctx.inject(['webServer'], (serverCtx) => {
        ctx.effect(() => serverCtx.webServer.register({
            kind: 'exact',
            path: IMAGE_URL,
            handler: async (_req, res) => {
                const image = config.image.get()
                const contentType = CONTENT_TYPES[extname(image).toLowerCase()]
                    ?? 'application/octet-stream'
                res.writeHead(200, { 'content-type': contentType })
                res.end(await readFile(image))
            },
        }))
    })

    // 样式在每次页面渲染时重新生成，所以透明度保存后刷新页面即生效。
    ctx.on('webserver/index-inject', (table) => {
        table.push({ kind: 'style', text: buildStyle(config.opacity.get()) })
    })

    // volatile 提交成功时 Loader 向本插件派发这个事件，参数是变了的字段路径。
    // 07 篇说过 ctx.logger 不往终端打，要肉眼可见的证据就自己 console.log。
    ctx.on('loader/volatile-update', (paths) => {
        console.log(`[${name}] 设置已热提交：${paths.map((path) => path.join('.')).join(', ')}`)
    })
}

/** 用配置值生成样式：静态选择器来自 style.css，只有遮罩浓度随配置变化。 */
function buildStyle(opacity: number): string {
    // 透明度的实现：在图片上盖一层与页面底色同色的遮罩，越不透明遮得越多。
    const veilPercent = Math.round((1 - opacity) * 100)
    const veil = `color-mix(in srgb, var(--dsw-alias-bg-base) ${veilPercent}%, transparent)`
    const styleSheet = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
    return `:root { --dsh-chat-background-veil: ${veil}; }\n${styleSheet}`
}
