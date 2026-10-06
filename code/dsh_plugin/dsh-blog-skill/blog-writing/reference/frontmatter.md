---
flowix_key: 3vek6ngm
---

# frontmatter 字段规则

每篇正文文章的 frontmatter 六个字段，一个不能少：

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

| 字段 | 规则 |
| --- | --- |
| `title` | 见名知意，不用「杂项」「其他」这类词 |
| `date` | 写成那天的日期，`YYYY-MM-DD` |
| `tags` | YAML 列表，一个标签一行 |
| `column` | 专栏 id，必须在根目录 `config.yml` 的 `columns:` 里注册过；不属于任何专栏才留空 |
| `order` | 整数，全专栏唯一、连续，决定阅读顺序；必须与文件名 `NN-描述.md` 的 `NN` 一致 |
| `viewable` | 固定 `true` |

## 常见错误

- **`NN` 与 `order` 不一致**：`tool/check-columns.sh` 直接报错。改了其中一个，另一个必须同步改。
- **给参考卡片编号**：`参考/` 下的卡片不写 `order`、文件名不带编号——它不在阅读序列里，不占文章号。
- **新增专栏忘了注册**：`column` 的值没进 `config.yml` 的 `columns:`，站点不会生成专栏落地页。
- **`README.md` 改名**：专栏首页必须叫 `README.md`，`config.yml` 的 `exclude` 按这个确切文件名把它排除在发布之外，改名会被当成文章发出去。
