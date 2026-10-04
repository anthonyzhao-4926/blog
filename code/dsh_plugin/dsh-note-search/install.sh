#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$DIR"
pnpm install

# patch.yaml 里的插件行要写绝对路径，按本机位置重新生成。
cat > patch.yaml <<EOF
- insert:
    - id: dsh-note-search
      name: '$DIR/src/dsh-note-search.ts'
EOF

# 与 08/09 篇同一个 test profile；headless 也装一份，方便不看界面就验证。
for PROFILE in test headless; do
  dsh plugin --profile "$PROFILE" add "link:$DIR"

  # profile 覆盖层：把 root 指到本包自带的演示笔记。只追加、不覆盖——
  # 这个文件里还留着 08 篇的换源配置；已装过（有同 id 块）就跳过。
  PATCH_FILE="$HOME/.dsh/profiles/$PROFILE/cordis.patch.yml"
  mkdir -p "$(dirname "$PATCH_FILE")"
  touch "$PATCH_FILE"
  if ! grep -q 'id: dsh-note-search' "$PATCH_FILE"; then
    cat >> "$PATCH_FILE" <<EOF

# dsh-note-search：演示用笔记目录（10 篇）
- id: dsh-note-search
  config:
    root: '$DIR/notes'
EOF
  fi
done

echo "装好了。验证：dsh --profile test --dump-config | grep -A3 'id: dsh-note-search'"
