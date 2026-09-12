#!/usr/bin/env bash
# 专栏结构自检：链接可解析、图片存在、order 唯一、无孤儿文件、篇尾链路完整。
#
# 用法：
#   tool/check-columns.sh              # 检查仓库里所有专栏
#   tool/check-columns.sh golang_mcp   # 只检查一个专栏
#
# 对应《专栏写作规范.md》第七节的自检清单。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

if [ $# -eq 0 ]; then
  set -- claude-code claude-agent-sdk "linux 命令入门" golang_mcp "dsh 插件开发学习"
fi

# 先做一次全仓库的专栏注册一致性检查：文章里写了 column 的 id，必须在 config.yml 注册过
echo "══════════ 专栏注册一致性（config.yml）"
python3 - <<'REG' || fail=1
import io, glob, re, sys

cfg = io.open("config.yml", encoding="utf-8").read()
ids = re.findall(r"^\s*-\s*id:\s*(\S+)", cfg, re.M)
if not ids:
    print("  ✗ config.yml 里没解析到任何 columns[].id"); sys.exit(1)
print("  已注册: " + ", ".join(ids))

bad = []
for f in glob.glob("**/*.md", recursive=True):
    if f.split("/")[0] in ("local", "tool", ".trash", ".obsidian", "obsidian_template"):
        continue
    head = io.open(f, encoding="utf-8").read(800)
    m = re.search(r"^column:[ \t]*(\S*)[ \t]*$", head, re.M)
    if m and m.group(1) and m.group(1) not in ids:
        bad.append((m.group(1), f))

if bad:
    from collections import defaultdict
    by = defaultdict(list)
    for cid, f in bad:
        by[cid].append(f)
    for cid, fs in sorted(by.items()):
        print(f"  ✗ column={cid} 未在 config.yml 注册（{len(fs)} 篇，例如 {fs[0]}）")
    sys.exit(1)
print("  ✓ 所有非空 column 值都已注册")
REG

fail=0
for col in "$@"; do
  if [ ! -d "$col" ]; then
    echo "══════════ $col —— 跳过（目录不存在）"
    continue
  fi
  echo "══════════ $col"
  python3 - "$col" <<'PY' || fail=1
import io, os, re, sys, urllib.parse, glob

col = sys.argv[1]
files = sorted(glob.glob(os.path.join(col, "**", "*.md"), recursive=True))
problems = []

def is_ref(p):
    return os.sep + "参考" + os.sep in p

rows = []
for f in files:
    s = io.open(f, encoding="utf-8").read()
    m = re.search(r"^order:\s*(\S+)\s*$", s, re.M)
    order = m.group(1) if m and m.group(1) else None
    rows.append((f, s, order))

# 1. 内部 .md 链接
for f, s, _ in rows:
    d = os.path.dirname(f)
    for link in set(re.findall(r"\]\(([^)h][^)]*?\.md)(?:#[^)]*)?\)", s)):
        target = os.path.normpath(os.path.join(d, urllib.parse.unquote(link)))
        if not os.path.exists(target):
            problems.append(f"链接失效  {f}  ->  {link}")

# 2. 图片存在性
for f, s, _ in rows:
    refs = set(re.findall(r"\]\((assets/[^)]+)\)", s))          # ![alt](assets/x.png)
    refs |= set(re.findall(r"src=[\"'](assets/[^\"']+)[\"']", s))  # <img src="assets/x.png">
    for a in refs:
        real = urllib.parse.unquote(a)
        if not os.path.exists(real):
            problems.append(f"图片缺失  {f}  ->  {a}")

# 3. order 唯一性（参考卡片不编号、不带 order，不参与）
seen = {}
for f, _, o in rows:
    if f.endswith("README.md") or is_ref(f) or o is None:
        continue
    seen.setdefault(o, []).append(f)
for o, fs in seen.items():
    if len(fs) > 1:
        problems.append(f"order 重复  order={o}  被 {', '.join(fs)} 共用")

# 4. 孤儿文件（无人引用其文件名）
for f, _, _ in rows:
    if os.path.basename(f) == "README.md":
        continue
    base = os.path.basename(f)
    variants = (base, base.replace(" ", "%20"))
    if not any(any(v in s for v in variants) for g, s, _ in rows if g != f):
        problems.append(f"无入链    {f}")

# 5. 篇尾链路（参考卡片与未发布草稿不参与——链条只描述公开阅读路径）
unpub = {f for f, sv, _ in rows if re.search(r"^viewable:\s*false\s*$", sv, re.M)}

def sort_key(row):
    o, f, _ = row
    if o is not None and o.lstrip("-").isdigit():
        return (0, int(o), f)
    return (1, 0, f)

spine = sorted(
    [(o, f, s) for f, s, o in rows
     if not is_ref(f) and not f.endswith("README.md") and f not in unpub],
    key=sort_key,
)
for i, (o, f, s) in enumerate(spine):
    m = re.search(r"\*\*下一篇\*\*：\[[^\]]+\]\(([^)#]+)", s)
    if i + 1 < len(spine):
        want = os.path.basename(spine[i + 1][1])
        got = urllib.parse.unquote(os.path.basename(m.group(1))) if m else None
        if got != want:
            problems.append(f"链路断裂  {f}  ->  {got or '无「下一篇」'}  (应为 {want})")
    else:
        if "主线到此结束" not in s:
            problems.append(f"缺终点标记  {f}  (末篇应写「主线到此结束」)")

# 6. 文件名编号必须与 order 一致（参考卡片不编号，跳过）
for f, _s, o in rows:
    base = os.path.basename(f)
    if base == "README.md" or is_ref(f):
        continue
    m = re.match(r"^(\d+)-", base)
    if not m:
        problems.append(f"文件名缺编号  {f}")
    elif o is not None and int(m.group(1)) != int(o):
        problems.append(f"编号与 order 不一致  {f}（文件名 {m.group(1)} / order {o}）")

if unpub:
    print(f"  · 未发布草稿（不参与链路）: {', '.join(os.path.basename(x) for x in sorted(unpub))}")

if problems:
    for p in problems:
        print("  ✗ " + p)
    sys.exit(1)
print(f"  ✓ {len(rows)} 个文件：链接 / 图片 / order / 入链 / 链路 全部通过")
PY
done
exit $fail
