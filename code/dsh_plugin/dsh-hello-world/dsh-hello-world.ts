import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-hello-world'

export function apply(ctx: Context) {
    console.log('hello world')
}
