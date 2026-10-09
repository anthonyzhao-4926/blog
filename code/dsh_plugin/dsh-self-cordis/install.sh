#!/usr/bin/env bash
# 装 dsh-self-cordis：把 DSH 自带的自修改工具集挂到 test profile。
#
# 装之前想清楚：这等于给会话里的模型开了一个「在进程内存里写插件」的口子，
# 它的代码在进程内执行，不在 agent 的文件沙箱之内。只在你信任这个会话时开。
set -euo pipefail

cd "$(dirname "$0")"

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。起会话后让模型走一遍："
echo "  cordis_inspect_list → cordis_define → cordis_run → cordis_inspect_self"
echo "  cordis_stop（定义还在）→ cordis_undefine（连定义一起删）"
echo "重启 dsh，cordis_inspect_self 返回空——定义只在内存里。"
