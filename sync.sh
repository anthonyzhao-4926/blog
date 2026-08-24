#!/bin/zsh
# 定时同步脚本：git add . && git commit -m "同步数据" && git push

REPO="/Users/anthonyzhao/anthonyzhao/blog/blog"
cd "$REPO" || exit 1

# 有变更才提交推送，避免"nothing to commit"报错刷日志
if [ -n "$(git status --porcelain)" ]; then
    git add .
    git commit -m "同步数据"
    git push
    echo "$(date '+%Y-%m-%d %H:%M:%S') 同步完成"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') 无变更，跳过"
fi
