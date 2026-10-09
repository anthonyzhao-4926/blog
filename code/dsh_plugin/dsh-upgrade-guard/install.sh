#!/usr/bin/env bash
# 装 dsh-upgrade-guard：填绝对路径 → 装依赖并构建 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|__PLUGIN_DIR__|$PWD|g" cordis.patch.yml

# prepare 脚本会跑 build.mjs，所以 pnpm install 之后 lib/ 就有了。
pnpm install
dsh plugin --profile test add link:.

echo
echo "装好了。先跑一次体检："
echo "  ./doctor.sh test"
