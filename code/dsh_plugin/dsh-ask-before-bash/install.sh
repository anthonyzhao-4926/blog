#!/usr/bin/env bash
# 装 dsh-ask-before-bash：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-ask-before-bash|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. 让模型跑 git status（放行）与 git push（应当弹出审批卡）"
echo "  2. 批准之后再跑一次同样的 git push——还会问：allowed-once 只管这一次"
echo "  3. dsh --profile headless 跑同一命令：no approval channel is available"
