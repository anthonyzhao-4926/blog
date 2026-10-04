// dsh-chat-background.ts — 最小实现：把本地图片设置为聊天背景
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明（module augmentation），编译后剥离，运行时零开销
import type { } from '@deepseek-ai/dsh-host-webserver'

export const name = 'dsh-chat-background'

// 图片在插件根目录（../），样式表与源码同目录；都用 import.meta.url 解析
const IMAGE_PATH = new URL('../image.jpg', import.meta.url).pathname
const IMAGE_URL = '/dsh-chat-background/image.jpg'
const STYLE = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

export function apply(ctx: Context): void {
    // 1. 注册路由：浏览器请求 IMAGE_URL 时返回图片
    ctx.inject(['webServer'], (serverCtx) => {
        const webServer = serverCtx.webServer
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: IMAGE_URL,
            handler: async (_req, res) => {
                res.writeHead(200, { 'content-type': 'image/jpeg' })
                res.end(await readFile(IMAGE_PATH))
            },
        }))
    })

    // 2. 注入样式：把 style.css 内容原样注入每个 index 响应
    ctx.on('webserver/index-inject', (table) => {
        table.push({ kind: 'style', text: STYLE })
    })
}
