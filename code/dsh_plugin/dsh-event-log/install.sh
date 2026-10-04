#!/usr/bin/env bash
# 把本目录装成 bundle。
#
#   ./install.sh            # 装进 test profile（09 篇用的就是它）
#   ./install.sh web        # 装进别的 profile
#
# 做两件事：
#   1. 在本目录 pnpm install（插件自己的依赖，只用类型，但要给编辑器/tsc 用）；
#   2. dsh plugin add 把本包加进 profile 的 dsh.profile.bundles，
#      于是本包的 patch.yaml 会插三行。
#
# 注意：本篇不写 <profile>/cordis.patch.yml——插件没有配置项，
# 也就不该覆盖 08 篇留在那儿的覆盖层。
#
# 想撤销：dsh plugin --profile <p> remove dsh-event-log
set -euo pipefail

PROFILE="${1:-test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST_DIR="$HOME/.dsh/profiles/$PROFILE"

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

cat <<ROWS

先看装配（dsh --profile $PROFILE --dump-config）：
  - id: dsh-event-lab    5 个监听器
  - id: dsh-event-probe  路由 /dsh-event-lab/fire
  - id: dsh-event-stats  路由 /dsh-event-log/stats

再启动（web 默认占 3080，别和自己正在用的那个抢端口）：
  dsh --profile $PROFILE --no-open --port 3099

五种分发模式各看一次：
  for m in emit parallel serial bail waterfall; do
      curl -s "http://127.0.0.1:3099/dsh-event-lab/fire?mode=\$m"; echo
  done
  短路的管道（mode=waterfall&veto=1）：
  curl -s 'http://127.0.0.1:3099/dsh-event-lab/fire?mode=waterfall&veto=1'

真实事件（先让模型跑一次工具调用）：
  curl -s 'http://127.0.0.1:3099/dsh-event-log/stats'
ROWS
