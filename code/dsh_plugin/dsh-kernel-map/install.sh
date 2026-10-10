#!/usr/bin/env bash
# 装 dsh-kernel-map：填两个绝对路径 → 构建 → 挂进 test profile。
set -euo pipefail

cd "$(dirname "$0")"

# 插件目录：插件行指 lib/index.js，所以这里填本目录。
sed -i '' "s|__PLUGIN_DIR__|$PWD|g" cordis.patch.yml

# 检出目录：默认取仓库里自带的快照；换成本机路径时改这一行或设 DSH_REPO_ROOT。
# 快照目录名带版本后缀，换快照时这里要跟着改。
REPO_ROOT="${DSH_REPO_ROOT:-$(cd ../../../local/deepseek-harness-dsh-v0.2.0-rc.2 2>/dev/null && pwd || echo '')}"
if [ -z "$REPO_ROOT" ]; then
    echo "找不到 DSH 检出目录。设一下 DSH_REPO_ROOT，或手改 cordis.patch.yml 里的 repoRoot。" >&2
    exit 1
fi
sed -i '' "s|/绝对路径/deepseek-harness|$REPO_ROOT|g" cordis.patch.yml

pnpm install
pnpm run build
dsh plugin --profile test add link:.

echo
echo "装好了。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A4 'id: kernel-map'"
echo "  2. 问模型「DSH 里有哪些 waterfall 事件」——它会调 kernel_event_map，"
echo "     答案来自 docs/event-producer-consumer.md，不来自模型的记忆。"
echo "  3. 在检出目录改一行源码、跑 pnpm run gen-doc-graphs，再问一次："
echo "     行号变了，插件跟着变。手抄一份清单就不会有这个性质。"
