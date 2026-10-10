#!/usr/bin/env bash
# 装 dsh-command-kit：填绝对路径 → 装依赖 → 挂进 test profile → 打印验证步骤。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-command-kit|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步（都要在带界面的 profile 里做——命令是给人敲的）："
echo "  1. dsh --profile test --dump-config | grep -n 'command-kit'"
echo "     期望两行：command-kit-brief、command-kit-stats。"
echo "  2. 在输入框敲 /brief 主题，命令卡会给出回执；随后模型收到一条 user message，"
echo "     里面有主题与（若有）图片。"
echo "  3. 敲 /kit-stats —— 它读的是日志里那几个计数，自身一个 token 都不花。"
echo
echo "两个反例："
echo "  · 敲 /brief 后什么都不输入、也不贴图 → 应该报「用法」，因为主题与附件都空。"
echo "  · 把 patch.yaml 里 brief 那行的 acceptAttachments 改成 false 后重装，"
echo "     再贴图敲 /brief → executor 在 handler 之前就拒了，命令卡上是 error。"
