#!/usr/bin/env bash
# 装 dsh-fs-write-watch：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-fs-write-watch|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. 会话里让模型调 policy_report，看模式和可写根"
echo "  2. 同一文件先 read 再 edit 能成；跳过 read 直接 edit 会拿到 file has not been read"
echo "  3. 切到 read-only，看 write 被拒后的 [sandbox: file access denied under read-only mode] 标记"
