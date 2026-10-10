/**
 * 聊天背景插件的浏览器半：在设置页「插件」的「插件配置」页签里，给 Host 半
 * 注册的那个 settings namespace 挂一张卡片。
 *
 * 这个文件不跑在 Node 里。它被打包成 lib/client.js，由客户端模块系统
 * （dsh-client-modules）送进浏览器，在页面里的另一个 Cordis 上下文上再跑一次
 * apply。两边唯一的约定是一个字符串：Host 半注册的 settings namespace 与这里
 * 注册进 settings.plugins.tab 槽位的 id 必须一字不差，插件页把两者对起来，
 * 谁都不需要认识对方。
 *
 * 值从 ctx.configForms 取到的共享表单上读，写也从它上面提交。组件拿不到 ctx，
 * 快照源与写回调由注册时的 inject 工厂递进去。
 */
import { useState } from 'react'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { Context } from '@deepseek-ai/cordis'
// 只引入类型声明（编译后剥离，运行时由页面的模块表提供实现）：
// ctx.slots 的 Context 合并，ctx.configForms 的 Context 合并，
// 以及 SlotMap 里的 settings.plugins.tab 条目与卡片 props 份额。
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

/** 槽位 key = Host 半注册的 settings namespace，必须一字不差。 */
const SETTINGS_NS = 'dsh-chat-background-settings'

/** 本卡片编辑的字段：Host 那份 schema 的一个子集（这里刚好是全部）。 */
interface BackgroundConfig {
    image?: string
    opacity?: number
}

/** 本卡片的注入面：一个快照源加两个普通回调。组件永远拿不到 ctx。 */
interface BackgroundCardFace {
    hooks: { backgroundConfig: SnapshotStore<ConfigFormSnapshot<BackgroundConfig>> }
    /** 提交一组字段修改，返回 Host 是否真的把它们写进了用户层。 */
    save: (patch: BackgroundConfig) => Promise<boolean>
    /** 清掉某个字段的用户层覆盖，让它回落到组合层与 schema 默认值。 */
    reset: (field: keyof BackgroundConfig) => Promise<boolean>
}

/** 卡片 props：运行期份额 + 注入面（hooks 里的键会被绑成 useBackgroundConfig）。 */
export type BackgroundCardProps =
    PropsRuntime<'settings.plugins.tab'>
    & InjectFace<BackgroundCardFace>

export const inject = ['slots', 'configForms']

export function apply(ctx: Context): void {
    // configForms 是页面里的服务：取到 Host 那个 namespace 的共享表单，
    // 读快照、订阅变更、提交写。表单的生命周期挂在本次 apply 的 fiber 上。
    const form = ctx.configForms.get<BackgroundConfig>(SETTINGS_NS)
    const store = createSnapshotStore(form.getSnapshot())
    ctx.effect(
        () => form.subscribe(() => { store.set(form.getSnapshot()) }),
        'dsh-chat-background-settings: settings mirror',
    )

    // slots.inject 等槽位声明出现再注册，槽位消失（或本插件卸载）时撤销。
    ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: SETTINGS_NS,
        label: '背景图与透明度',
        inject: () => ({
            hooks: { backgroundConfig: store },
            // 写之后读回来看有没有落地：Host 拒绝写入时 form.set 也是正常返回，
            // 不抛错，所以「保存成功了吗」直接看它返回的布尔值，而不是 await 有没有 throw。
            save: async (patch: BackgroundConfig): Promise<boolean> => {
                const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
                const results = await Promise.all(entries.map(([field, value]) => form.set(field, value)))
                return results.every(Boolean)
            },
            reset: (field: keyof BackgroundConfig): Promise<boolean> => form.unset(field),
        }),
    }, BackgroundCard))
}

/**
 * 本插件那张卡片。页签把各家的卡片放进一个列表，所以最外层是 li。
 * 输入全部来自 props：inject 里 hooks 的 backgroundConfig 被渲染器绑成
 * useBackgroundConfig，两个回调直接是 inject 返回的成员。
 * @param props - 快照选择器与写回调。
 * @returns 卡片，或（Host 不再服务这个 namespace 时）什么都不渲染。
 */
function BackgroundCard(props: BackgroundCardProps) {
    const state = props.useBackgroundConfig(snapshot => snapshot)
    const [message, setMessage] = useState('')
    if (state.status === 'loading') return <li>正在读取当前配置…</li>
    if (state.status === 'unavailable') return null
    return (
        <li>
            <h3>背景图与透明度</h3>
            {/*
              key=revision：保存被接受后 revision 增加，表单重挂载，输入框回到新值；
              被拒绝时 revision 不变，用户填的还留在框里。
            */}
            <form key={String(state.revision)} onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const patch: BackgroundConfig = {
                    image: String(data.get('image')),
                    opacity: Number(data.get('opacity')),
                }
                void props.save(patch).then((ok) => {
                    setMessage(
                        ok ? '已保存：刷新页面看新背景。' : '保存被拒绝：值不合法，或配置刚在别处被改过。',
                    )
                })
            }}>
                <p>
                    <label>背景图路径 <input name="image" size={40} defaultValue={state.value?.image} /></label>
                </p>
                <p>
                    <label>透明度（0–1） <input name="opacity" type="number" min={0} max={1} step={0.05} defaultValue={state.value?.opacity} /></label>
                </p>
                <button type="submit" disabled={!state.writable}>保存</button>
                <button
                    type="button"
                    disabled={!state.writable}
                    onClick={() => { void props.reset('opacity') }}
                >
                    重置透明度
                </button>
                <p>{message}</p>
            </form>
        </li>
    )
}
