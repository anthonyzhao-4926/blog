#!/usr/bin/env bash
# 装 dsh-mcp-lab：装依赖 → 挂进 test profile。
# 这是装配包形态：没有 src/，正文与配置就是全部内容。
set -euo pipefail

cd "$(dirname "$0")"

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证："
echo "  1. dsh --profile test --dump-config | grep -A6 'id: mcp-github'"
echo "  2. 起一次会话，看模型的工具列表里有没有 mcp__github__*"
echo "  3. 让模型调其中一个，观察返回"
echo
echo "想验证「连不上会怎样」：故意把 command 改成一个不存在的程序，"
echo "  harness 仍会启动，只是这台服务器的工具不出现、日志里有一条错误。"
echo "  再把 failOnStartupError 改成 true，启动就会直接中止。"
