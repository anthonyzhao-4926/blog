# dsh-command-kit

第 35 篇《给团队加一条命令》的配套 demo。一个包，两条命令，正好是这一篇的两半：

| 插件 | 命令 | 演示什么 |
| --- | --- | --- |
| `command-kit-brief` | `/brief <主题> [图片]` | 命令直接执行、附件准入、handler 自己把内容投递给模型 |
| `command-kit-stats` | `/kit-stats` | 命令、反馈、交付物三类事件都只落日志，服务面要自己折 |

## 三个反直觉的地方

- **命令的返回值不进模型。** `/brief` 的 `success` 文案只出现在命令卡上；模型看到的是 handler
  自己 `agent.steer()` 投递的那条 user message。`/kit-stats` 则两头都不进。
- **附件是 executor 拦的，不是 handler 拦的。** `input.attachments` 没声明时，贴图敲命令会在
  handler 之前就变成 error；声明之后，图片与文件才以 `ImageBlock` / `FileBlock` 落进
  `invocation.attachments`。
- **`rawInput` 带着分隔空白。** 所以所有 handler 第一件事都是 `.trim()`。

## 装法

```sh
./install.sh
```

它会填 `patch.yaml` 里的绝对路径、装依赖、把包挂进 `test` profile。

## 装配前提

- 命令是**敲给人看的**。`headless` / `sdk` 这类没有前端的装配里，注册表也在（base bundle 挂着
  `@deepseek-ai/dsh-commands`），但没有 adapter 去发现和调用它；`sdk-minimal` 连注册表都没有。
  所以验证要在带界面的 profile 里做。
- `present` 工具在 `standard` / `cordis` / `ptc` 三个预设里，`minimal` 没有。`/brief` 的提示词
  让模型交付文件，用的是这个出厂工具。

## 看什么

1. `dsh --profile test --dump-config | grep -n 'command-kit'` —— 两行都在。
2. 敲 `/brief 主题`：命令卡给出回执，随后模型开始写简报，收尾时交付卡片出现。
3. 敲 `/kit-stats`：读的是 `/kit-stats` 自己折出来的四个计数。
4. 把 `patch.yaml` 里 `acceptAttachments` 改成 `false` 重装，再贴图敲 `/brief` —— 这次是
   error，因为准入发生在 handler 之前。
