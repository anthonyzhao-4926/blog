#!/usr/bin/env bash
# 装 dsh-native-hook：填绝对路径 → 构建 → 挂进 test profile → 打印 A/B 的做法。
set -euo pipefail

cd "$(dirname "$0")"

sed -i '' "s|__PLUGIN_DIR__|$PWD|g" cordis.patch.yml

pnpm install
pnpm run build
dsh plugin --profile test add link:.

echo
echo "装好了（A 面：native hook）。验证三步："
echo "  1. dsh --profile test --dump-config | grep -A6 'id: native-hook'"
echo "  2. 让模型跑 rm -rf /tmp/x —— 会被拒，原因那句就是我们配置里写的那句。"
echo "     查会话日志：没有 hook/ 开头的记录。native hook 不写。"
echo
echo "现在换成 B 面（桥）：把 cordis.patch.yml 里 A 那半注释掉、B 那半解开，"
echo "再 ./install.sh 一次，同一个 prompt 重跑。"
echo "  1. dsh --profile test --dump-config | grep -A4 'id: hooks-claude-code'"
echo "  2. 同样被拒，但会话日志里多了一对 hook/invoked + hook/result，"
echo "     dialect 是 claude-code，exitCode 是 2，reason 来自 stderr。"
echo "  3. 再看本会话的开头：CC 的 SessionStart 是 detached 跑的，"
echo "     那段注入的上下文可能压根没赶上第一个请求。"
