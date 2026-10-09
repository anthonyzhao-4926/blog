# dsh-upgrade-guard

把 `engines.dsh` 从「没人读的声明」变成自己的硬检查，并同时提供两条诊断出口：一条 HTTP 报告（现在到底跑在哪个内核上）与一条运行期不变式（不满足就启动即炸）。

配套文章：[DSH 升级后的版本与兼容性排查](../../../dsh%20插件开发学习/20-DSH 升级后的版本与兼容性排查.md)

## 装

```sh
./install.sh
```

`install.sh` 做三件事：把 `cordis.patch.yml` 里的 `__PLUGIN_DIR__` 换成绝对路径、`pnpm install`（`prepare` 会跑 `build.mjs` 产出 `lib/`）、把包挂进 `test` profile。

## 验证

```sh
# 出口二：确认 patch 三行都进了组合树，且没有 warn
dsh --profile test --dump-config | grep -A4 upgrade-guard
dsh --profile test --dump-config 2>&1 >/dev/null | grep -c 'not found'   # 期望 0

# 出口四：本机 dsh 版本 vs 插件声明的区间
dsh --version
dsh plugin --profile test why @deepseek-ai/dsh-tools

# 出口一的报告面：起 web，读路由
dsh --profile test web --no-open &
curl -s http://127.0.0.1:3080/api/dsh-upgrade-guard/report

# 故意破坏：把 cordis.patch.yml 里的 enginesDsh 改成 '>=0.99.0'，重启后应看到
#   invariant violated by "dsh-upgrade-guard": 内核 ... 不满足 >=0.99.0
```

## 已知限制

- `--dump-config` 需要 profile 已经初始化过一次，而且不会准备 `$DSH_HOME/profiles/node_modules` 下的运行时模块 fallback。所以它可能报模块解析问题而不是 patch 问题——先确认 profile 能正常起。
- `@deepseek-ai/dsh-invariants` 目前发在 `next` dist-tag 上（`latest` 还停在更早的预发布）。如果 `pnpm install` 装不到，把依赖改成 `next`，或者直接用它已经在 `$DSH_HOME/profiles/node_modules` 里的那一份。
- 本插件和内核的版本判定是自己实现的（`satisfiesCaret` 只覆盖 `^x.y.z-pre` 这一种形状）。要完整的 semver 语义就换成 `semver` 包——重点是**判定必须由你做**，DSH 不会替你做。
