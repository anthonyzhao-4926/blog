#!/usr/bin/env bash
# 装 dsh-note-hits：装依赖 → 生成 patch.yaml → 挂进 test 与 headless 两个 profile。
# headless 那份是为了不看界面就能验证。
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$DIR"
pnpm install

cat > patch.yaml <<EOF
# dsh-note-hits 的 bundle 补丁。
- insert:
    - id: dsh-note-hits
      name: '$DIR/src/dsh-note-hits.ts'
EOF

for PROFILE in test headless; do
    dsh plugin --profile "$PROFILE" add "link:$DIR"
done

echo
echo "装好了。验证："
echo "  dsh --profile test --dump-config | grep -A3 'id: dsh-note-hits'"
echo "  dsh --profile headless        # 第一次：第 1 次启动"
echo "  cat ~/.dsh/storages/note_hits.json"
echo "  dsh --profile headless        # 第二次：第 2 次启动，文件里 boots 变成 2"
echo
echo "密钥那一半："
echo "  DEEPSEEK_API_KEY=sk-demo dsh --profile headless   # 只打来源层和长度"
