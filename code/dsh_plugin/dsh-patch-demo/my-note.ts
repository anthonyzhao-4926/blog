// 03 篇「insert」的演示插件：最小到不需要任何依赖。
// 它在模块被加载、以及 apply 被调用时各打印一行——看到这两行，
// 就说明 patch 里那一行 insert 真的把这行挂进了插件树。

export const name = 'dsh-note'

export function apply() {
    console.log('[dsh-note] 我被 patch 插进了插件树，apply() 执行了')
}
