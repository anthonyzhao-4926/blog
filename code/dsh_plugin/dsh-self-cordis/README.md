# dsh-self-cordis

把 DSH 自带的自修改工具集（`dsh-tool-cordis` + `dsh-cordis-host-runner`）装进一个 profile 的组合包。

## 装

```sh
pnpm install
dsh plugin --profile test add link:.
```

本包只有一份 `cordis.patch.yml`，没有自己的插件代码——它演示的是 18 篇那句「组合包就是附带一个配置层的 npm 包」。

## 装上之后模型多了什么

七个工具：`cordis_inspect_list`、`cordis_inspect_query`、`cordis_inspect_self` 三个只读检查；`cordis_define`、`cordis_run`、`cordis_stop`、`cordis_undefine` 四个生命周期操作。

典型走法：先 `cordis_inspect_query` 查清楚要用的服务或 slot 的约定，`cordis_define` 把源码登记成一个包版本，`cordis_run` 激活它。技术性失败之后用 `cordis_inspect_self` 读诊断，往同一个插件追加修正版再 `update`。

## 边界

- **定义是会话级、进程本地的。** 只有定义它的会话看得见、管得着；其他会话读作不存在。DSH 重启即消失，会话日志里只留 define 的参数与回执。
- **运行期会影响同一进程里的其他会话。** 动态包声明或改动的服务进的是全局服务存储，别的会话读得到。这是「同进程」的直接后果，不是缺陷。
- **沙箱是给老实代码用的围栏，不是安全边界。** `vmTimeoutMs` 只围得住同步部分，异步函数体逃得出去；沙箱给的 `ctx` 只有极少数方法，但动态包照样能提供全局服务。
- **装载本包要像授予 bash 那样慎重。** 原话见 `dsh-tool-cordis` 的 README：加载它应当和授予 bash 访问一样刻意。
