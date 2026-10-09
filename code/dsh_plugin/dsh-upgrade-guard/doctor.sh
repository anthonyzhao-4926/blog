#!/usr/bin/env bash
# 升级 dsh 之后的体检：把三处证据一次打完。
# 用法：./doctor.sh [profile]，默认 test。
set -euo pipefail

PROFILE="${1:-test}"

echo "== 1. 版本 =="
dsh --version

echo
echo "== 2. 配置树里的 patch 有没有打空（升级最常坏的地方） =="
dsh --profile "$PROFILE" --dump-config >/dev/null 2> /tmp/dsh-dump.err || true
if grep -q 'not found' /tmp/dsh-dump.err; then
    echo "有 patch 目标不存在："
    grep 'not found' /tmp/dsh-dump.err
else
    echo "没有找不到目标的 patch"
fi

echo
echo "== 3. 插件实际解析到哪份内核 =="
dsh plugin --profile "$PROFILE" why @deepseek-ai/dsh-tools || true
