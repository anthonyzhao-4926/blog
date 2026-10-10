#!/usr/bin/env bash
# 装 dsh-self-cordis：把 DSH 自带的运行期检查工具集挂到 test profile。
#
# 装之前想清楚：动态包在进程内执行，不在 agent 的文件沙箱之内。
# 只在你信任这个会话时开。
set -euo pipefail

cd "$(dirname "$0")"

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。起会话后让模型走一遍："
echo "  cordis_inspect_list → cordis_inspect_query"
echo "想在浏览器面板里定义并运行动态包：带浏览器半的会先要你批准。"
echo "重启 dsh，面板里的定义全没了——它们只在进程内存里。"
