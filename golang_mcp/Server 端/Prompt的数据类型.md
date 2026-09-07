---
title: Prompt的数据类型
date: 2026-03-28
tags: [go, mcp, ai]
column: golang-mcp
order: 11
viewable: true
---

# mcp.Prompt 注册提示词时传入的提示词元信息

```go
	s.AddPrompt(&mcp.Prompt{
		Name:        "error-analysis-prompt",
		Description: "错误分析：根据服务名和时间范围，自动查日志并分析根因",
		Arguments: []*mcp.PromptArgument{
			{Name: "service_name", Description: "服务名称"},
			{Name: "time_range", Description: `时间范围，如 "30m", "1h", 或 "start ~ end"`},
		},
	}, promptHandler)
```

| 字段名 | 作用 |
| --- | --- |
| Arguments | 模板参数列表，供 `prompts/get` 传入并完成渲染。 |
| Description | 可选说明，帮助用户理解该 prompt 的用途。 |
| Name | 唯一标识 |
| Title | 可选展示标题，面向 UI，通常比 `name` 更易读。 |
| Icons | 可选图标，用于界面展示。 |

## mcp.PromptArgument

| 字段名 | 作用 |
| --- | --- |
| Name | 程序侧使用的参数键；`prompts/get` 的 `arguments` 里用该名字传值；<br>无 `title` 时也可作为展示名。 |
| Title | 可选的 UI 展示标题，面向最终用户，通常比 `name` 更易读。 |
| Description | 可选说明，解释该参数含义与填写方式。 |
| Required | 是否必填；为 true 时客户端应在调用 `prompts/get` 前保证传入该参数。 |

# mcp.GetPromptRequest Prompt 请求参数

| 字段名 | 作用 |
| --- | --- |
| `Arguments` | 传给提示模板的参数：键为参数名，值为字符串，用于模板占位符替换。 |
| `Name` | 客户端传递过来的Prompt名称。 |

分别对应注册时设置的如下内容

![image](assets/1774697448281-fe9e1d64-8ea1-4650-b88a-ef723d8599ed.png)

# mcp.GetPromptResult Handler 返回的结果

```go
func promptHandler(_ context.Context, req *mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	// 获取输入的参数
	args := req.Params.Arguments
	svr := strings.TrimSpace(args["service_name"])
	timeRange := strings.TrimSpace(args["time_range"])

	// 构造提示词模板的数据
	data := errorAnalysisPromptData{
		ServiceName: svr,
		TimeRange:   timeRange,
	}

	// 渲染提示词模板
	var buf strings.Builder
	if err := errorAnalysisTmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("渲染提示词模板: %w", err)
	}
	text := strings.TrimSpace(buf.String()) + "\n"

	// 返回提示词结果
	return &mcp.GetPromptResult{
		Description: "错误分析：根据服务名和时间范围，自动查日志并分析根因",
		Messages: []*mcp.PromptMessage{
			{Role: "user", Content: &mcp.TextContent{Text: text}},
		},
	}, nil
}
```

| 字段名 | 作用 |
| --- | --- |
| Description | 可选，对本条展开结果或该 prompt 的补充说明。 |
| Messages | 展开后供模型使用的对话消息列表；<br>每条为 `PromptMessage`（含 `role` 与 `content`，可多轮、可含内嵌资源等）。 |

## mcp.PromptMessage

| 字段名 | 作用 |
| --- | --- |
| Role | 说话方角色，协议上为 `user` 或 `assistant`。 |
| Content | 单条消息的内容块；类型由 JSON 里 `type` 区分，可包含内嵌资源等多形态内容。 |

Content 不仅仅在Prompt有用到，它是一个公共定义。具体内容详见

[Content](Content.md)
