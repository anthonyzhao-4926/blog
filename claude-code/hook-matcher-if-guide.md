---
title: Hook Matcher 和 If 字段详解
date: 2026-07-08
tags: [ai, claude]
column: claude-code
order: 9
viewable: true
---

## Hook Matcher 和 If 字段详解

### 核心区别

**Matcher** 和 **If** 构成了两层过滤机制：

- **Matcher**：一级过滤器，决定整个 hook 组是否激活
- **If**：二级过滤器，决定具体的 hook 处理程序是否运行

---

### Matcher 详解

#### 评估规则

Matcher 的解析取决于其内容：

| 值 | 作用 | 示例 |
|---|------|------|
| `"*"` / `""` / 省略 | 匹配所有事件 | 总是触发 |
| 仅含字母、数字、`_`、`-` | 精确字符串或列表 | `"Bash"` 、`"Edit\|Write"` |
| 包含其他字符 | JavaScript 正则表达式 | `"^mcp__.*"` |

#### 按事件类型的 Matcher 目标

```javascript
// 工具事件（PreToolUse、PostToolUse）
"matcher": "Bash"              // 仅过滤 Bash 工具
"matcher": "Edit|Write"        // Edit 或 Write 工具

// SessionStart 事件
"matcher": "startup|resume"    // 区分新会话或恢复

// Notification 事件
"matcher": "permission_prompt" // 权限提示通知

// 某些事件不支持 matcher
// UserPromptSubmit、PostToolBatch、Stop 等总是触发
```

---

### If 详解

#### 用途和约束

- **只用于工具事件**：`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest` 等
- **其他事件忽略 If**：在非工具事件上配置 `if` 的 hook 永不运行
- **权限规则语法**：格式为 `"工具名(模式)"`，如 `"Bash(rm *)"` 或 `"Edit(*.ts)"`

#### 实际例子：防止删除操作

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": ".claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

**执行流程**：
1. 触发事件 → `Bash` 工具调用
2. **Matcher 检查**：`"Bash"` ✓ 匹配
3. **If 检查**：`"Bash(rm *)"` ✓ 匹配 `rm -rf` 
4. **Hook 执行**：运行 `block-rm.sh`

#### Bash 模式匹配规则

| If 模式 | 命令 | 结果 | 原因 |
|--------|------|------|------|
| `Bash(git *)` | `FOO=bar git push` | ✓ | 前导赋值被剥离 |
| `Bash(git *)` | `npm test && git push` | ✓ | 逐个检查子命令 |
| `Bash(rm *)` | `echo $(rm -rf /)` | ✓ | `$()` 内的命令被检查 |
| `Bash(rm *)` | `echo $(date)` | ✗ | 无匹配子命令 |

---

### 性能优化

- **Matcher 失败** → 整个 hook 组跳过（避免启动进程）
- **If 失败** → 跳过单个 handler（更精细的过滤）

这样可以避免不必要的脚本执行开销。

---

### 解析流程

**解析顺序**（必须全部匹配，hook 才运行）：

1. **事件触发** → 2. **Matcher 检查** → 3. **If 条件检查** → 4. **Hook 执行**

---

### 关键要点总结

| 特性 | Matcher | If |
|-----|---------|-----|
| **目的** | 一级过滤：确定 hook 组何时激活 | 二级过滤：确定单个 handler 何时运行 |
| **作用域** | 影响整个 hook 组 | 影响单个 hook 处理程序 |
| **支持事件** | 大部分事件 | 仅工具事件 |
| **性能** | 匹配失败时跳过整个 hook 组 | 匹配失败时避免进程生成 |
| **语法** | 精确字符串或正则表达式 | 权限规则语法 |
