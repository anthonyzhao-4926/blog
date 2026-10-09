#!/usr/bin/env bash
# 装 dsh-turn-cost：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-turn-cost|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: dsh-turn-cost'"
echo "  2. 让模型读一个不存在的文件，再跑一个正常工具"
echo "  3. 让模型调 turn_cost，看 usage / time / pressure / failures 四块"
echo
echo "对照实验：在同一个会话里连读两次 turn_cost，中间什么都不做——两次数字应当完全相同。"
