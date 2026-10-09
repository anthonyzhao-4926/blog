#!/usr/bin/env bash
# 装 dsh-live-greeter：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-live-greeter|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。下一步："
echo "  1. dsh --profile test --dump-config | grep -c live-greeter-mount   # 1"
echo "  2. dsh --profile test --dump-config | grep -c greeter-tool         # 0（内存插件不在配置树里）"
echo "  3. 起会话，让模型调 live_greet；再改一行 patch 触发热重载，看 unmount 日志"
