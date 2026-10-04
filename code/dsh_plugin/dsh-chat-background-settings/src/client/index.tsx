/**
 * 聊天背景插件的浏览器半：在 Plugins 页给本插件的那一行挂一个配置页。
 *
 * 这个文件不跑在 Node 里。它被打包成 lib/client.js，由客户端模块系统
 * （dsh-client-modules）送进浏览器，在页面里的另一个 Cordis 上下文上再跑
 * 一次 apply。页面通过 Plugins 页声明的 plugins.row.config 槽位挂上去；
 * Plugins 页按这一行的 entry id 找到设置服务里的同名 namespace，把该
 * namespace 的表单（state + mutate）作为 prop 喂给我们的组件。
 */
import { useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明：ctx.slots 的 Context 合并，以及 SlotMap 里的
// 'plugins.row.config' 条目与页面 props 类型。运行时由模块表提供实现。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigPageForm, PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'

/** 槽位 key：<包名>#<行 id>，行 id 以 bundle 的 patch.yaml 声明为准。 */
const SLOT_KEY = 'dsh-chat-background-settings#dsh-chat-background-settings'

export const inject = ['slots']

export function apply(ctx: Context): void {
    // slots.inject 等槽位声明出现再注册，槽位消失（或本插件卸载）时撤销。
    ctx.effect(() => ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: SLOT_KEY,
    }, BackgroundSettingsPage)))
}

/** 一行的配置页：view 是 'summary' 时渲染一句话，'page' 时渲染表单。 */
function BackgroundSettingsPage({ view, form }: PluginConfigViewProps) {
    if (view === 'summary') return <>背景图与透明度</>
    if (form === undefined) return null
    return <BackgroundForm form={form} />
}

function BackgroundForm({ form }: { form: ConfigPageForm }) {
    const [message, setMessage] = useState('')
    const { state } = form
    if (state.status !== 'ready' || state.value === undefined) return <p>正在读取当前配置…</p>
    const value = state.value as { image?: string, opacity?: number }
    return (
        // key=revision：保存被接受后 revision 增加，表单重挂载，输入框回到新值。
        <form key={state.revision} onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void form.mutate([
                { op: 'set', path: ['image'], value: String(data.get('image')) },
                { op: 'set', path: ['opacity'], value: Number(data.get('opacity')) },
            ], state.revision).then((ok) => setMessage(
                ok ? '已保存，刷新页面看新背景。' : '保存被拒绝：值不合法，或配置刚在别处被改过。',
            ))
        }}>
            <p>
                <label>背景图路径 <input name="image" size={40} defaultValue={value.image} /></label>
            </p>
            <p>
                <label>透明度（0–1） <input name="opacity" type="number" min={0} max={1} step={0.05} defaultValue={value.opacity} /></label>
            </p>
            <button type="submit" disabled={!state.writable}>保存</button>
            <p>{message}</p>
        </form>
    )
}
