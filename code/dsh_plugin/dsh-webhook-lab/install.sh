#!/usr/bin/env bash
# 装 dsh-webhook-lab：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-webhook-lab|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: webhook-lab'"
echo "  2. 起一次 web，向 webhook 路由 POST 一个 issue opened 的 JSON，看是否开出会话"
echo "  3. 同一个交付再 POST 一次 —— 会再开一个会话（runtime 不去重，防重是你的事）"
