/**
 * note_search 的卡片：每条命中一行，能打开文件，也能把后续动作送回会话。
 *
 * 组件是纯渲染：数据全部来自 props。工具结果在 block 里（会话事件投影的
 * 产物），打开文件的 openFile 是 slot 属主给的，送回会话的 sendPrompt 是
 * 注册时 inject 工厂注入的。组件里不读会话、不做 IO。
 */
import type { ToolCallPhaseProps, ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

/** 一条命中：与 10 篇 note_search 的 output.presentationMeta 投影约定一致。 */
interface NoteSearchHit {
    readonly path: string
    readonly line: number
    readonly snippet: string
}

/** 注册时 inject 工厂注入的回调（见 index.ts）。 */
export interface NoteSearchCardInjected {
    /** 把一句话送回会话：'queue' 排成下一轮，'steer' 打断当前轮。 */
    readonly sendPrompt: (text: string, mode: 'queue' | 'steer') => void
}

type NoteSearchCardProps = ToolCallViewProps & NoteSearchCardInjected

/** result 阶段的 block：已配对的工具结果节点。 */
type ResultBlock = Extract<ToolCallPhaseProps, { readonly phase: 'result' }>['block']

/**
 * 从持久化的 result.meta 里校验出命中列表。meta 是会话日志里的数据——旧
 * 会话、别的版本写下的形状都可能不符；不符就返回 null，调用方退回原文。
 */
function readHits(meta: unknown): NoteSearchHit[] | null {
    if (typeof meta !== 'object' || meta === null) return null
    const hits = (meta as { readonly hits?: unknown }).hits
    if (!Array.isArray(hits)) return null
    const valid = hits.filter((hit): hit is NoteSearchHit =>
        typeof hit === 'object' && hit !== null
        && typeof (hit as NoteSearchHit).path === 'string'
        && typeof (hit as NoteSearchHit).line === 'number'
        && typeof (hit as NoteSearchHit).snippet === 'string')
    return valid.length === hits.length ? valid : null
}

/** content 里给模型看的那份文本，meta 缺席时的退路。 */
function resultText(block: ResultBlock): string {
    return block.content.map(part => (part.type === 'text' ? part.text : '')).join('\n')
}

export function NoteSearchCard(props: NoteSearchCardProps) {
    // 调用还在准备或进行：一行占位。结果到了，这个组件会拿着新 block 重渲染。
    if (props.phase !== 'result') {
        return <div style={{ opacity: 0.6, fontSize: 12 }}>{props.toolName} 搜索中…</div>
    }
    const { block } = props
    // 失败调用与 meta 形状不符的结果，都退回 content 原文——卡片是增强，不是门槛。
    const hits = block.isError ? null : readHits(block.meta)
    if (hits === null) {
        return <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{resultText(block)}</pre>
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {hits.map(hit => (
                <div
                    key={`${hit.path}:${hit.line}`}
                    style={{ border: '1px solid var(--dsw-line, #444)', borderRadius: 8, padding: '6px 10px' }}
                >
                    <button
                        style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, color: 'inherit', textDecoration: 'underline' }}
                        onClick={() => props.openFile(hit.path, { line: hit.line })}
                    >
                        {hit.path}:{hit.line}
                    </button>
                    <div style={{ opacity: 0.75, marginTop: 2 }}>{hit.snippet}</div>
                </div>
            ))}
            {hits.length > 0 && (
                <button
                    style={{ alignSelf: 'flex-start', cursor: 'pointer', borderRadius: 6, padding: '2px 10px' }}
                    onClick={() => props.sendPrompt(
                        `用 note_search 再搜一些和「${hits[0]!.path}」相关的笔记`, 'queue',
                    )}
                >
                    再搜相关笔记
                </button>
            )}
        </div>
    )
}
