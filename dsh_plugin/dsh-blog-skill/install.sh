#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 本包放在 <博客仓库>/dsh_plugin/dsh-blog-skill/，往上两级就是博客仓库根。
# 项目级扫描根是 <项目根>/.dsh/skills——项目根即含 .git 的最近祖先目录。
BLOG_ROOT="$(cd "$DIR/../.." && pwd)"
TARGET="$BLOG_ROOT/.dsh/skills"

# skill 不是 Cordis 插件：不用 pnpm install、不用 dsh plugin add，
# 文件进了扫描根就被 skill-filesystem 提供方发现。先清旧副本再复制，保证可重复执行。
mkdir -p "$TARGET"
rm -rf "$TARGET/blog-writing" "$TARGET/blog-publish.md"
cp -R "$DIR/blog-writing" "$TARGET/blog-writing"
cp "$DIR/blog-publish.md" "$TARGET/blog-publish.md"

echo "已装到 $TARGET："
echo "  blog-writing/SKILL.md  目录形态（正文 + reference/ + templates/）"
echo "  blog-publish.md        平铺形态（仅 /blog-publish 唤起）"
echo "扫描根有被监视，新会话的 skill 目录里就能看到，不用重启。"
