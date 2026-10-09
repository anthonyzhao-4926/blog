#!/usr/bin/env bash
# 装 dsh-llm-ollama：填绝对路径 → 装依赖 → 挂进 test profile。
#
# 装完还没完：这个插件只是把 provider 路由挂上，会话用哪条路由是
# agent-default-model 的配置。照着文章「让会话用上它」一节，在 profile 的
# cordis.patch.yml 里把 agent-default-model 指到 ollama。
set -euo pipefail

cd "$(dirname "$0")"

# patch.yaml 里的 /绝对路径/ 占位符换成这个目录的真实路径（重复执行是无操作）。
sed -i '' "s|/绝对路径/dsh-llm-ollama|$PWD|g" patch.yaml

pnpm install
dsh plugin --profile test add link:.

echo
echo "插件装好了。下一步：在 profile 的 cordis.patch.yml 里加上"
echo "  - id: agent-default-model"
echo "    config:"
echo "      provider: ollama"
echo "      model: <ollama 里的模型名>"
