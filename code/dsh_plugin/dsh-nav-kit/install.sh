#!/usr/bin/env bash
# 装 dsh-nav-kit：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-nav-kit|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证四步："
echo "  1. dsh --profile test --dump-config | grep -n 'nav-kit'"
echo "     期望五行，顺序是 lsp、md-links、terminal-journal、pty、pty-bash。"
echo "  2. 让模型开一个长驻终端，跑一条会打印很多行的命令，再用 terminal_journal 翻回去。"
echo "     重点看返回里的 lineBegin / lineEnd / totalLines —— count 只是请求，"
echo "     真正生效的是后端的字节上限。"
echo "  3. 让模型用 lsp 工具查一篇笔记里 [[某篇笔记]] 的定义。"
echo "     它应该跳到那篇笔记的第 0 行。"
echo "  4. 用同一行的链接查 findReferences —— 结果包含所有引用它的行，"
echo "     包括它自己声明的那一行：includeDeclaration 固定开着，调用方没有开关。"
