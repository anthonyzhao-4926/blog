#!/usr/bin/env bash
# 把 DSH 当成一个组件跑一遍：先看四个 profile 各是什么，再手写一次协议对话。
set -euo pipefail

cd "$(dirname "$0")"

echo "== 1. 五个 profile 的组成（都基于 dsh-base，除了 sdk-minimal）=="
echo "  dsh --profile headless \"任务\"   # 一次性命令行任务"
echo "  dsh --profile web                # 浏览器应用"
echo "  dsh --profile sdk                # SDK JSON-RPC stdio 服务器"
echo "  dsh --profile sdk-minimal        # 不用 base 的极简 SDK 应用"
echo "  dsh --profile acp                # 仅面向自动化的 ACP stdio 服务器"
echo

echo "== 2. 最省事的一条路：headless 一次性任务 =="
dsh --profile headless "用一句话说明你看到的当前目录里有什么"

echo
echo "== 3. 需要多轮、需要拿结构化事件：手写一次 JSON-RPC =="
node client.mjs "用一句话说明你现在跑在哪个 profile 上。"
