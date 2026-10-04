#!/usr/bin/env bash
# 把本目录的 cordis.patch.yml 装进某个 profile，并把占位符换成真实绝对路径。
#
#   ./install.sh            # 装进 test profile（03 篇用的就是它）
#   ./install.sh web        # 装进别的 profile
#
# 做三件事：
#   1. 把 __ABS_PATH__ 替换成本目录的绝对路径；
#   2. 备份目标 profile 已有的 cordis.patch.yml（有才备份）；
#   3. 写入目标 profile，随后打印 --dump-config 里该看的几行。
#
# 想撤销：把备份覆盖回去，或直接 `printf '[]\n' > <profile>/cordis.patch.yml`。
set -euo pipefail

PROFILE="${1:-test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST_DIR="$HOME/.dsh/profiles/$PROFILE"
DST="$DST_DIR/cordis.patch.yml"

if [ ! -d "$DST_DIR" ]; then
    echo "找不到 profile 目录：$DST_DIR" >&2
    echo "先在 ~/.dsh/profiles 下建好这个 profile（见 01 篇），再回来跑本脚本。" >&2
    exit 1
fi

if [ -f "$DST" ]; then
    cp "$DST" "$DST.bak.$(date +%Y%m%d%H%M%S)"
    echo "已备份原文件：$DST"
fi

sed "s|__ABS_PATH__|$HERE|g" "$HERE/cordis.patch.yml" > "$DST"
echo "已写入：$DST"
echo

echo "现在核对这两条（dsh --profile $PROFILE --dump-config）："
cat <<'ROWS'
  - id: session-title → config 应变成 fallbackMaxWords 3 / fallbackMaxBytes 16 / maxTitleBytes 30
  - id: dsh-note      → 应出现在树尾，name 是 file:///…/my-note.ts
ROWS
echo
echo "跑一次看结果："
echo "  dsh --profile $PROFILE --dump-config | grep -A6 'id: session-title'"
echo
echo "真启动验证（web 默认占 3080，如果已被占用就换端口）："
echo "  dsh --profile $PROFILE --no-open --port 3099"
echo "  日志里应出现：[dsh-note] 我被 patch 插进了插件树，apply() 执行了"
