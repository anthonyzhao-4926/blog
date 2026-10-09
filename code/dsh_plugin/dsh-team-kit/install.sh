#!/usr/bin/env bash
# 本地开发用：构建 → 装进 test profile。
# 同事那边不跑这个，他们跑 README 里那条 dsh plugin add。
set -euo pipefail

cd "$(dirname "$0")"

pnpm install
# lib/ 是包的主入口，patch 行按包名解析的就是它——改完 src/ 要重新构建
pnpm run build
dsh plugin --profile test add link:.
