#!/usr/bin/env bash
# 装 dsh-prompt-lab：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-prompt-lab|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: dsh-prompt-lab'"
echo "  2. 起一次会话问「本仓库的文档放哪」，看它答得对不对"
echo "  3. 把 order 改成 100 再问一次 —— 段落位置变了，但内容一样"
echo "     （同一段文本在不同位置，模型的注意力分配会不一样）"
