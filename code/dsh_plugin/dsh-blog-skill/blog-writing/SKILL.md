---
name: blog-writing
description: 本博客仓库的撰文规矩：专栏文章文件名 NN-描述.md、frontmatter 六个字段、配图放专栏的 assets/ 目录、文章骨架。在本仓库新建或修改专栏文章时使用。
---

# 博客撰文规矩

本仓库是中文技术博客，文章按专栏组织，一个专栏一个目录（如 `dsh 插件开发学习/`），专栏 id 在根目录 `config.yml` 的 `columns:` 里注册。

## 文件名

- 正文文章一律 `NN-描述.md`，`NN` 是补零到两位的编号，必须与 frontmatter 的 `order` 一致（`tool/check-columns.sh` 会校验，对不上直接报错）。
- 不编号的只有两类：专栏首页 `README.md` 和 `参考/` 下的查阅卡片。参考卡片不写 `order`。

## frontmatter

每篇开头必须有 `title`、`date`、`tags`、`column`、`order`、`viewable` 六个字段，格式：

```yaml
---
title: <标题>
date: <YYYY-MM-DD>
tags:
  - <标签>
column: <专栏 id>
order: <整数>
viewable: true
---
```

每个字段的取值规则与常见错误见 `reference/frontmatter.md`，写文章前读一次。

## 配图

- 图片放在本专栏目录的 `assets/` 子目录下，正文用相对路径引用（`assets/文件名.png`）。
- 文件名带时间戳或语义（如 `20260930-skill-catalog.png`），不要叫 `image.png`、`1.png`。

## 文章骨架

新文章从 `templates/article.md` 复制骨架：开头三行（读完你能 / 前置 / 约 N 分钟）→ `## 目标` → 正文 → `## 注意事项` → `---` → 结尾的「下一篇」链接。小节标题一律用名词短语。

## 写完之后

运行 `tool/check-columns.sh <专栏目录名>` 校验文章间链接、图片存在、`order` 唯一，无报错才算写完。
