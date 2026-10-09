#!/usr/bin/env bash
# 装 dsh-subagent-survey：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-subagent-survey|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: dsh-subagent-survey'"
echo "  2. 让模型调 subagent_survey，看有哪些提供方、各自支持什么"
echo "  3. 把某个提供方从 patch 里停用，再跑一次，看它从矩阵里消失"
