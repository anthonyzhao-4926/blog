#!/usr/bin/env bash
# 装 dsh-session-digest：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-session-digest|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证四步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: dsh-session-digest'"
echo "  2. 造一个大工具结果，看排水是否生效（可在 profile 里把 maxInlineBytes 调小）"
echo "  3. 会话里输入 /compact，看日志里的 compaction 行"
echo "  4. 让模型调 session_digest，账本应当记下刚才那次压缩"
