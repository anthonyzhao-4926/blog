#!/usr/bin/env bash
# 把本目录的 cordis.patch.yml 装进某个 profile，并把占位符换成真实绝对路径。
#
#   ./install.sh            # 装进 test profile（07 篇用的就是它）
#   ./install.sh web        # 装进别的 profile
#
# 做三件事：
#   1. 把 __ABS_PATH__ 替换成本目录的绝对路径；
#   2. 备份目标 profile 已有的 cordis.patch.yml（有才备份）；
#   3. 写入目标 profile，随后打印该看的两处。
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

cat <<ROWS
先确认装配（dsh --profile $PROFILE --dump-config）：
  - id: hmr          → config.root 应是 ${HERE}（web profile 里这行默认启用，
                       disabled 保留 dsh-base 的 !!js 表达式，不用改）
  - id: dsh-hmr-demo → 应出现在树尾，config.tag 是 patched-v1
ROWS
echo
echo "再启动看热重载（web 默认占 3080，别和自己正在用的那个抢端口）："
echo "  dsh --profile $PROFILE --no-open --port 3099"
echo "  日志里应出现：[dsh-hmr-demo] apply() 执行：tag=patched-v1，VERSION=src-v1"
echo
echo "验证路由："
echo "  curl http://127.0.0.1:3099/dsh-hmr-demo/ping"
