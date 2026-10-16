---
sorting-spec: |-
  # 对库内所有文件夹（含任意层级嵌套）生效：
  # 文件按 frontmatter 的 order 字段升序排列；没有 order 字段的文件排在最后、按文件名排列
  target-folder: /*
  < a-z by-metadata: order
---
