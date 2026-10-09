#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
pnpm install
# 浏览器半的产物：改了 src/client/ 之后要重跑这一步，页面拿到的才是新代码
pnpm run build
dsh plugin --profile test add link:.
