---
name: blog-publish
description: 发布前检查单：核对本仓库一篇专栏文章是否满足发布条件。只由用户用 /blog-publish 唤起，模型不自动加载。
disable-model-invocation: true
---

# 发布前检查单

用户唤起时会指定一篇文章（或默认检查最近改动的那篇）。逐项核对并汇报结果，任何一项不过都明确说出来：

1. 文件名 `NN-描述.md` 的 `NN` 与 frontmatter 的 `order` 一致；
2. frontmatter 六个字段（`title` / `date` / `tags` / `column` / `order` / `viewable`）齐全，`column` 在根目录 `config.yml` 的 `columns:` 里注册过；
3. 开头三行（读完你能 / 前置 / 约 N 分钟）与结尾的「下一篇」链接都在；
4. 正文引用的图片文件真实存在于本专栏的 `assets/` 目录；
5. 运行 `tool/check-columns.sh <专栏目录名>` 无报错。
