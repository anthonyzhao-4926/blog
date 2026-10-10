#!/usr/bin/env bash
# 装 dsh-session-audit：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-session-audit|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A4 'id: session-audit'"
echo "  2. 让模型调用 session_format_audit —— 它会给出写入器版本、磁盘上的会话数、"
echo "     需要迁移的数量，以及正规 API 看到的会话数。"
echo "  3. 手工看一眼会话根，对照输出："
echo "       ls ~/.dsh/sessions/*/*/ | head"
echo "     文件名里的 .vN 就是磁盘世代；正规 API 给的逻辑头永远是当前写入器版本。"
echo
echo "注意：体检本身什么都不写。真要迁移，用 DSH 检出目录里那个一次性脚本（不是本目录）："
echo "  cd /path/to/deepseek-harness"
echo "  pnpm run migrate:sessions-to-v4 --sessions-dir ~/.dsh/sessions"
