# dsh-self-cordis

把 DSH 自带的运行期检查工具集（`dsh-cordis-host-runner` + `dsh-tool-cordis/host` + `dsh-tool-cordis`）装进一个 profile 的组合包。

## 装

```sh
pnpm install
dsh plugin --profile test add link:.
```

本包只有一份 `cordis.patch.yml`，没有自己的插件代码——它演示的是 18 篇那句「组合包就是附带一个配置层的 npm 包」。

## 装上之后模型多了什么

两个只读检查工具：`cordis_inspect_list` 列出当前已知的检查提供方，`cordis_inspect_query` 按 provider 与 method 去读服务方法、事件模式、插件 Config schema、工具 schema 或实时 slot 树。它们不能调用业务方法，也不能改运行时。

动态定义（`define` / `run` / `stop` / `undefine`）是 `ctx.dynamicCordisRunner` 上的服务动词，没有对应的模型工具：程序调用方和浏览器面板用它。模型要持久化地装插件，走 Plugin Manager 那行工具。

## 边界

- **定义是会话级、进程本地的。** 只有定义它的会话看得见、管得着；其他会话读作不存在。DSH 重启即消失，会话日志里只留 define 的参数与回执。
- **运行期会影响同一进程里的其他会话。** 动态包声明的服务进的是存活运行时，别的会话读得到。这是「同进程」的直接后果，不是缺陷。
- **沙箱是给老实代码用的围栏，不是安全边界。** `vmTimeoutMs` 只围得住同步部分，异步函数体逃得出去；沙箱给的是一层不含框架内部机制的 façade，但声明的服务照样触及存活运行时。
- **带浏览器半的包会一直等页面。** `run` 返回 `status: 'awaiting-approval'` 后挂起，没有页面连着的部署会挂到提问的轮次被取消。
- **装载本包要像授予 bash 那样慎重。** 原话见 `dsh-cordis-host-runner` 的 README：对待动态包要像对待 bash 访问一样刻意。
