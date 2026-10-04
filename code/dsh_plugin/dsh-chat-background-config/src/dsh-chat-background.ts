import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// 只引入类型声明（module augmentation），编译后剥离，运行时零开销
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-chat-background-config'

// 图片走 HTTP 路由供给浏览器；路由地址固定，读的是 config.image 指向的文件
const IMAGE_URL = '/dsh-chat-background-config/image.jpg'
// 默认图片：插件自带的 image.jpg，用 import.meta.url 解析成绝对路径
const DEFAULT_IMAGE = new URL('../image.jpg', import.meta.url).pathname

// 允许的图片扩展名 → Content-Type；换成 PNG/WebP 时响应头要跟着变
const CONTENT_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}

export interface Config {
    /** 背景图片的绝对路径。 */
    image: string
    /** 图片显示强度：0 完全透明，1 完全不透明。 */
    opacity: number
}

export const Config: Schema<Config> = Schema.object({
    image: Schema.string().default(DEFAULT_IMAGE),
    opacity: Schema.number().min(0).max(1).default(0.35),
})

export function apply(ctx: Context, config: Config): void {
    // 1. 注册路由：浏览器请求 IMAGE_URL 时返回 config.image 指向的文件
    ctx.inject(['webServer'], (serverCtx) => {
        const webServer = serverCtx.webServer
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: IMAGE_URL,
            handler: async (_req, res) => {
                const contentType = CONTENT_TYPES[extname(config.image).toLowerCase()]
                    ?? 'application/octet-stream'
                res.writeHead(200, { 'content-type': contentType })
                res.end(await readFile(config.image))
            },
        }))
    })

    // 2. 注入样式：把 config.opacity 变成一个 CSS 变量，再拼上静态样式表
    ctx.on('webserver/index-inject', (table) => {
        table.push({ kind: 'style', text: buildStyle(config) })
    })
}

/** 用配置值生成样式：静态选择器来自 style.css，只有遮罩浓度随配置变化。 */
function buildStyle(config: Config): string {
    // 透明度的实现：在图片上盖一层与页面底色同色的遮罩，越不透明遮得越多
    const veilPercent = Math.round((1 - config.opacity) * 100)
    const veil = `color-mix(in srgb, var(--dsw-alias-bg-base) ${veilPercent}%, transparent)`
    const styleSheet = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
    return `:root { --dsh-chat-background-veil: ${veil}; }\n${styleSheet}`
}
