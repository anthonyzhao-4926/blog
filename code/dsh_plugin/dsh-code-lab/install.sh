#!/usr/bin/env bash
# 装 dsh-code-lab：填绝对路径 → 装依赖 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|/绝对路径/dsh-code-lab|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。验证四步，重点是后两步："
echo "  1. dsh --profile test --dump-config | grep -A3 'id: code-lab'"
echo "  2. 让模型跑一段正常代码，看打印输出与返回值"
echo "  3. 让它跑一段会抛异常的代码 —— 失败是一个字段，不是异常"
echo "  4. 让它跑一段死循环 —— 得到的是 timeout，不是 exception"
echo "     两者混在一起的话，模型就不知道该改代码还是该缩短任务"
