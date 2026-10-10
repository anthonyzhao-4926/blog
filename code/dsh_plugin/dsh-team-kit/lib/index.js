import Schema from "@deepseek-ai/schemastery";
const name = "dsh-team-kit";
const inject = ["systemPrompt"];
const Config = Schema.object({
  conventions: Schema.string().default(
    "\u63D0\u4EA4\u4FE1\u606F\u7528\u4E2D\u6587\u5199\uFF0C\u4E00\u6B21\u63D0\u4EA4\u53EA\u505A\u4E00\u4EF6\u4E8B\u3002\u6539\u52A8\u524D\u5148\u8DD1\u4E00\u904D\u76F8\u5173\u6D4B\u8BD5\u3002"
  )
});
function apply(ctx, config) {
  ctx.systemPrompt.section({
    name: "team:conventions",
    order: 900,
    text: config.conventions
  });
}
export {
  Config,
  apply,
  inject,
  name
};
