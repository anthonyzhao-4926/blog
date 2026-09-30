/**
 * dsh-note-card 的宿主半：什么都不做。
 *
 * 这个包的能力全在浏览器半（src/client/）。宿主半存在的理由是让本包成为
 * Loader 的一个条目：客户端模块扫描（14 篇）从 Loader 条目出发找到本包的
 * package.json，看见里面的 dsh.client 声明，才会把 lib/client.js 送进页面。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-note-card'

export function apply(_ctx: Context): void {}
