#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$DIR"
pnpm install

# 浏览器半：产出 lib/client.js（dsh.client 声明的 ./client 导出指向它）。
pnpm run build

# patch.yaml 里的插件行要写绝对路径，按本机位置重新生成。
cat > patch.yaml <<EOF
- insert:
    - id: dsh-chat-background-settings
      name: '$DIR/src/dsh-chat-background.ts'
EOF

# 与前几篇同一个 test profile。不写 profile 覆盖层——配置留给设置页，
# cordis.patch.yml 里还留着 08 篇的换源配置。
dsh plugin --profile test add "link:$DIR"

echo "装好了。启动 dsh --profile test --no-open，在「设置 → 插件 → 插件配置」里找 dsh-chat-background-settings 那张卡片。"
