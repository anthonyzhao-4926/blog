import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
const name = "dsh-kernel-map";
const inject = ["tools"];
function parseEventMatrix(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const event = /^`([^`]+)`$/u.exec(cells[1] ?? "")?.[1];
    const mode = /^`([^`]+)`$/u.exec(cells[2] ?? "")?.[1];
    const declaredIn = /^\[`([^`]+)`\]/u.exec(cells[3] ?? "")?.[1];
    if (event !== void 0 && mode !== void 0 && declaredIn !== void 0) {
      rows.push({ event, mode, declaredIn });
    }
  }
  return rows;
}
function apply(ctx, config) {
  const matrixPath = join(config.repoRoot, "docs/event-producer-consumer.md");
  const rows = parseEventMatrix(readFileSync(matrixPath, "utf8"));
  const byMode = {};
  for (const row of rows) byMode[row.mode] = (byMode[row.mode] ?? 0) + 1;
  ctx.tools.register(defineTool({
    name: "kernel_event_map",
    description: "\u67E5\u8BE2 DSH \u7684\u4E8B\u4EF6\u5730\u56FE\uFF1A\u6309\u5206\u53D1\u6A21\u5F0F\u6216\u540D\u5B57\u7247\u6BB5\u5217\u51FA\u4E8B\u4EF6\uFF0C\u9644\u58F0\u660E\u5904\u7684\u6E90\u7801\u4F4D\u7F6E\u3002\u6570\u636E\u6765\u81EA\u4ED3\u5E93\u91CC\u90A3\u4EFD\u673A\u68B0\u751F\u6210\u7684\u6587\u6863\uFF0C\u4E0D\u662F\u9760\u8BB0\u5FC6\u3002",
    parameters: {
      mode: { type: "string", description: "\u53EA\u770B\u8FD9\u4E00\u79CD\u5206\u53D1\u6A21\u5F0F\uFF0C\u4F8B\u5982 waterfall\u3002" },
      filter: { type: "string", description: "\u4E8B\u4EF6\u540D\u91CC\u5305\u542B\u8FD9\u4E2A\u5B50\u4E32\u3002" },
      limit: { type: "integer", description: "\u6700\u591A\u8FD4\u56DE\u591A\u5C11\u6761\uFF0C\u9ED8\u8BA4 10\u3002" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          hits: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                event: { type: "string", required: true },
                mode: { type: "string", required: true },
                declaredIn: { type: "string", required: true }
              }
            }
          },
          total: { type: "integer", required: true }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: `${value.total} \u6761\u547D\u4E2D
` + value.hits.map((hit) => `${hit.event}  [${hit.mode}]  ${hit.declaredIn}`).join("\n")
      }]
    },
    // 只读内存里那份表格，允许和其他调用并行。
    isConcurrencySafe: () => true,
    execute(args) {
      const hits = rows.filter((row) => (args.mode === void 0 || row.mode === args.mode) && (args.filter === void 0 || row.event.includes(args.filter)));
      return { hits: hits.slice(0, args.limit ?? 10), total: hits.length };
    }
  }));
  ctx.inject(["connection"], (connCtx) => {
    connCtx.connection.fetch.register({
      path: "/api/dsh-kernel-map/report",
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async () => new Response(JSON.stringify({
        total: rows.length,
        byMode,
        source: matrixPath
      }, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" }
      })
    });
  });
  console.log(`[${name}] \u8BFB\u5165 ${rows.length} \u6761\u4E8B\u4EF6\uFF0C\u6765\u6E90 ${matrixPath}`);
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
