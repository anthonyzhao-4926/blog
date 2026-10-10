# dsh-session-audit

第 38 篇《会话格式升级了》的配套 demo。**只读**的会话格式体检：

- 扫 `$DSH_HOME/sessions`，用官方的文件名解析器读出每个会话在磁盘上是第几代；
- 用正规 API `ctx.sessionPersistence.list()` 拿逻辑头，看一眼两边差在哪；
- 给每个会话判定 `current` / `migration-required` / `needs-newer-harness`，汇总成计数。

它不 `open(id, 'write')`、不 publish、不迁移。

## 为什么物理世代要自己扫

`stat` / `list` 返回的是**翻译过的逻辑头**，版本恒为当前写入器。公开 API 里没有一个字段
告诉你"这个会话在磁盘上写的是第几代"——那正是需要文件名解析器的原因：

```ts
const version = parseSessionFormatLogFilename(withoutCompressionSuffix(file))
```

临时名、大写、前导零、`.v0`、带压缩后缀的名字都不是规范名，所以别自己写正则。

## 装法

```sh
./install.sh
```

## 两个要注意的地方

- **沙箱**：体检要读 `$DSH_HOME`，它通常在会话工作区之外。受限模式下这一步可能被拒——
  那是一个真实的策略边界，不是插件的 bug。
- **只读**：读打开从不发布后继；只有写打开才会在**旁边**新增一个 `session.vN+1.jsonl`，
  前代文件按字节保留。所以"备份"这件事在 DSH 里的答案就是：前代文件还在那儿。
