/**
 * dsh-note-stats 的浏览器半。真实插件的这份文件由打包器生成（DSH 仓库里是
 * tsdown 的 clientBundle 预设，顺带处理 CSS Modules 与 sourcemap）；这里手写
 * 它的最小形态，好让「bundle 长什么样」看得见：
 *
 *   - 脚本执行只做一件事：把 { id, factory } 登记进 window.__ModuleLoader__；
 *   - id 必须等于 package.json 的 name（启动图里这一行的名字）；
 *   - factory 收到模块表的 require，第一次被 import 时才运行，返回插件导出；
 *   - require 能答平台模块（react、@deepseek-ai/cordis、ui-slots 等），
 *     其余依赖必须打包进这份文件——本插件没有别的依赖。
 */
window.__ModuleLoader__.load({
  id: 'dsh-note-stats',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /**
     * 裸 observable：getSnapshot + subscribe。注册时把它放进 inject 返回值的
     * hooks 隔间，渲染器就把它绑成组件的选择器钩子——noteStats 变成
     * props.useNoteStats。snapshot 身份要稳：值没变就返回同一个引用。
     */
    const createSource = (initial) => {
      let snapshot = initial
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set: (next) => {
          snapshot = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    const stats = createSource({ status: 'loading' })

    /**
     * 页面与 /api 同源，浏览器会话 cookie 自动带上，不用管 token。
     * 401/403 说明路由其实在、只是请求没过认证或信任检查。
     */
    const refresh = async () => {
      try {
        const response = await fetch('/api/dsh-note-stats/stats')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        stats.set({ status: 'ok', data: await response.json() })
      } catch (error) {
        stats.set({
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    /**
     * 设置页里的一节。props 里没有 ctx：close 来自槽位 owner，
     * useNoteStats 与 refresh 来自注册时的 inject 工厂。
     */
    const NoteStatsSection = (props) => {
      const view = props.useNoteStats((snapshot) => snapshot)
      React.useEffect(() => { void props.refresh() }, [])
      if (view.status === 'loading') return h('p', null, '读取中…')
      if (view.status === 'failed') {
        return h('div', null,
          h('p', null, `读取失败：${view.message}`),
          h('button', { onClick: () => void props.refresh() }, '重试'),
        )
      }
      const { data } = view
      return h('div', null,
        h('p', null, `笔记目录 ${data.root} 下共 ${data.notes} 篇笔记`),
        h('p', null, `note_search 被调了 ${data.searches.calls} 次，失败 ${data.searches.failures} 次`),
        data.searches.recent.length === 0
          ? h('p', null, '还没有搜过')
          : h('ul', null, data.searches.recent.map((record) =>
              h('li', { key: `${record.at}-${record.query}` },
                `${record.query}${record.ok ? '' : '（失败）'}`))),
        h('button', { onClick: () => void props.refresh() }, '刷新'),
      )
    }

    const apply = (ctx) => {
      // 等 settings.section 的声明出现再注册；声明塌了，这条贡献跟着撤。
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'note-stats',
        order: 90,
        label: '笔记统计',
        inject: () => ({ hooks: { noteStats: stats }, refresh }),
      }, NoteStatsSection))
    }

    return { inject: ['slots'], apply }
  },
})
