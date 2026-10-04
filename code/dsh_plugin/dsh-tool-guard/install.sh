#!/usr/bin/env bash
# 装 dsh-tool-guard：填绝对路径 → 装依赖 → 挂进 test profile。
# 不写 profile 覆盖层：本插件没有配置项（同 09 篇 dsh-event-log 的惯例），
# 别碰 cordis.patch.yml 里已有的配置。
set -euo pipefail

cd "$(dirname "$0")"

# patch.yaml 里的 /绝对路径/ 占位符换成这个目录的真实路径（重复执行是无操作）。
sed -i '' "s|/绝对路径/dsh-tool-guard|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.
