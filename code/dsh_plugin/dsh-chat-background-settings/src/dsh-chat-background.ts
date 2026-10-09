/**
 * 聊天背景插件（设置页版）的 Host 半：注册图片路由、往页面注入样式，
 * 并把这份配置注册成一个 settings namespace。
 *
 * 与 06 篇的 dsh-chat-background-config 是同一个插件，差别只有一处：apply 里把
 * 这份 config 交给设置服务（ctx.settings.installSection），换回来一个「当前生效
 * 配置」的取值函数。同事在设置页改，不碰 cordis.yml；写入后设置服务提交新值，
 * 本插件不重启，下一次 source() 就是新值。
 *
 * namespace 是插件自己起的字符串（约束见 SETTINGS_NS），与这一行在 profile 里的
 * entry id 无关。浏览器半（src/client/）注册卡片时用的 key 必须是同一个字符串，
 * 两边靠这一个名字会合。
 *
 * 这个文件跑在 Node 里（Host 进程）；浏览器里的卡片在 src/client/ 下。
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// 只引入类型声明：ctx.settings 的 Context 合并，以及 webServer 的路由与
// webserver/index-inject 事件类型。编译后剥离，运行时零开销。
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'

export const name = 'dsh-chat-background-settings'

/** 设置服务里的 namespace：小写字母开头，只含小写字母、数字、连字符。 */
const SETTINGS_NS = 'dsh-chat-background-settings'

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
    image: string
    /** 图片显示强度：0 完全透明，1 完全不透明。 */
    opacity: number
}

// 06 的 schema 原样保留：默认值、值域、非法值当场失败都在这里。
export const Config: Schema<Config> = Schema.object({
    image: Schema.string().default(DEFAULT_IMAGE),
    opacity: Schema.number().min(0).max(1).default(0.35),
})

export function apply(ctx: Context, config: Config): void {
    // 当前生效配置。设置服务挂上时由 setSource 换成设置服务的取值函数；
    // 没有设置服务（profile 没挂 provider）时，它就是 Loader 合成后交给
    // apply 的这份 config——这份回落是 cordis.yml 之外保留的第二个入口。
    let source: () => Config = () => config

    // 设置服务是可选依赖，用 ctx.inject 等它出现；它不在，插件照旧可配。
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.installSection(ctx, SETTINGS_NS, Config, config, {
            setSource: (current) => { source = current },
            // 路由和样式都是用到时现读 source()，没有需要重建的派生状态，
            // 所以这里空实现即可（有缓存或注册表要重建时才需要写）。
            onChange: () => {},
        })
    })

    // 路由每次请求现读一次 image：设置页保存后的下一次请求就用新图。
    ctx.inject(['webServer'], (serverCtx) => {
        ctx.effect(() => serverCtx.webServer.register({
            kind: 'exact',
            path: IMAGE_URL,
            handler: async (_req, res) => {
                const image = source().image
                const contentType = CONTENT_TYPES[extname(image).toLowerCase()]
                    ?? 'application/octet-stream'
                res.writeHead(200, { 'content-type': contentType })
                res.end(await readFile(image))
            },
        }))
    })

    // 样式在每次页面渲染时重新生成，所以透明度保存后刷新页面即生效。
    ctx.on('webserver/index-inject', (table) => {
        table.push({ kind: 'style', text: buildStyle(source().opacity) })
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
