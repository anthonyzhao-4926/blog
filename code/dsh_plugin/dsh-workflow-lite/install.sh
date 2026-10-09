#!/usr/bin/env bash
# 装 dsh-workflow-lite：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-workflow-lite|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: workflow-lite'"
echo "  2. 让模型调 fan_out，传三条互不依赖的小任务"
echo "  3. 把其中一条改成必然失败的事（比如让它读一个不存在的路径），"
echo "     再看返回：那一项消失，其余照常 —— 这就是逐项隔离"
