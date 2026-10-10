window.__ModuleLoader__.load({
	id: "dsh-chat-background-settings",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/**
		* 聊天背景插件的浏览器半：在 Plugins 页给本插件的那一行挂一个配置页。
		*
		* 这个文件不跑在 Node 里。它被打包成 lib/client.js，由客户端模块系统
		* （dsh-client-modules）送进浏览器，在页面里的另一个 Cordis 上下文上再跑
		* 一次 apply。页面通过 Plugins 页声明的 plugins.row.config 槽位挂上去；
		* Plugins 页按这一行的 entry id 找到设置服务里的同名 namespace，把该
		* namespace 的表单（state + mutate）作为 prop 喂给我们的组件。
		*
		* 基准版本：dsh 0.2.0-rc.2（源码快照 local/deepseek-harness-dsh-v0.2.0-rc.2/）。
		*/
		/** 槽位 key：<包名>#<行 id>，行 id 以 bundle 的 patch.yaml 声明为准。 */
		const SLOT_KEY = "dsh-chat-background-settings#dsh-chat-background-settings";
		const inject = ["slots"];
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
				name: "plugins.row.config",
				key: SLOT_KEY
			}, BackgroundSettingsPage)));
		}
		/** 一行的配置页：view 是 'summary' 时渲染一句话，'page' 时渲染表单。 */
		function BackgroundSettingsPage({ view, form }) {
			if (view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: "背景图与透明度" });
			if (form === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BackgroundForm, { form });
		}
		function BackgroundForm({ form }) {
			const [message, setMessage] = (0, react.useState)("");
			const { state } = form;
			if (state.status !== "ready" || state.value === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "正在读取当前配置…" });
			const value = state.value;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => {
					event.preventDefault();
					const data = new FormData(event.currentTarget);
					form.mutate([{
						op: "set",
						path: ["image"],
						value: String(data.get("image"))
					}, {
						op: "set",
						path: ["opacity"],
						value: Number(data.get("opacity"))
					}], state.revision).then((ok) => setMessage(ok ? "已保存，刷新页面看新背景。" : "保存被拒绝：值不合法，或配置刚在别处被改过。"));
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["背景图路径 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						name: "image",
						size: 40,
						defaultValue: value.image
					})] }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["透明度（0–1） ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						name: "opacity",
						type: "number",
						min: 0,
						max: 1,
						step: .05,
						defaultValue: value.opacity
					})] }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: !state.writable,
						children: "保存"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: message })
				]
			}, state.revision);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map