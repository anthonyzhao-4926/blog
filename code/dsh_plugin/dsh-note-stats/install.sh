#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# 把插件目录的绝对路径填进 patch.yaml 的占位符
sed -i '' "s|__PLUGIN_DIR__|$(pwd)|g" patch.yaml
pnpm install
dsh plugin --profile test add link:.
