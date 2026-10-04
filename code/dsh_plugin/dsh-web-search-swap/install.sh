#!/usr/bin/env bash
# 把本目录装成 bundle，并把它那份覆盖层写进某个 profile。
#
#   ./install.sh            # 装进 test profile（08 篇用的就是它）
#   ./install.sh web        # 装进别的 profile
#
# 做三件事：
#   1. 在本目录 pnpm install（插件自己的依赖，dsh-web 只用来取类型）；
#   2. dsh plugin add 把本包加进 profile 的 dsh.profile.bundles，
#      于是本包的 patch.yaml 会插两行——provider 本体和探针；
#   3. 把 cordis.patch.yml 的 __ABS_PATH__ 换成真实路径，写进 profile。
#
# 想撤销：dsh plugin --profile <p> remove dsh-web-search-swap，
# 再把 <profile>/cordis.patch.yml 换成备份（或写回 `[]`）。
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

if [ ! -d "$HERE/node_modules" ]; then
    echo "==> pnpm install"
    (cd "$HERE" && pnpm install)
fi

echo
echo "==> dsh plugin --profile $PROFILE add link:$HERE"
dsh plugin --profile "$PROFILE" add "link:$HERE"

if [ -f "$DST" ]; then
    cp "$DST" "$DST.bak.$(date +%Y%m%d%H%M%S)"
    echo "已备份原文件：$DST"
fi
sed "s|__ABS_PATH__|$HERE|g" "$HERE/cordis.patch.yml" > "$DST"
echo "已写入：$DST"
echo

cat <<ROWS
先看装配（dsh --profile $PROFILE --dump-config）：
  - id: web              → config.searchProvider 应是 notes-local
  - id: web-search-deepseek → 还在树上（注册了，但没被选中）
  - id: dsh-notes-search → 应在树尾，config.root 指向 ${HERE}/notes

再启动（web 默认占 3080，别和自己正在用的那个抢端口）：
  dsh --profile $PROFILE --no-open --port 3099
  日志里应出现：[dsh-notes-search] 已注册 provider notes-local（root=…/notes）

验证换源生效（换个词再试，笔记目录里的词才搜得到）：
  curl 'http://127.0.0.1:3099/dsh-search-probe/search?q=缓存'
  curl 'http://127.0.0.1:3099/dsh-search-probe/search?q=共识&limit=1'
ROWS
