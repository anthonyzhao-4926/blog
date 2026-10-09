#!/usr/bin/env bash
# 装 dsh-todo-digest：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-todo-digest|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: dsh-todo-digest'"
echo "  2. 让模型用 todo 工具列三件事，再调 todo_digest"
echo "  3. 让模型只把其中一件标成进行中、其余整表重写一次，再调 todo_digest"
echo "     —— 看它认的是最新那一份完整列表，不是增量"
