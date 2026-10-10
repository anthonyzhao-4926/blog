window.__ModuleLoader__.load({
	id: "dsh-chat-background-settings",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/**
		* 聊天背景插件的浏览器半：在设置页「插件」的「插件配置」页签里，给 Host 半
		* 注册的那个 settings namespace 挂一张卡片。
		*
		* 这个文件不跑在 Node 里。它被打包成 lib/client.js，由客户端模块系统
		* （dsh-client-modules）送进浏览器，在页面里的另一个 Cordis 上下文上再跑一次
		* apply。两边唯一的约定是一个字符串：Host 半注册的 settings namespace 与这里
		* 注册进 settings.plugin.item 槽位的 key 必须一字不差，插件页把两者对起来，
		* 谁都不需要认识对方。
		*
		* 值从 ctx.settingsScope 绑定的 scope 上读，写也从它上面提交。组件拿不到 ctx，
		* 快照源与写回调由注册时的 inject 工厂递进去。
		*/
		/** 槽位 key = Host 半注册的 settings namespace，必须一字不差。 */
		const SETTINGS_NS = "dsh-chat-background-settings";
		const inject = ["slots", "configForms"];
		function apply(ctx) {
			const form = ctx.configForms.get(SETTINGS_NS);
			const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(form.getSnapshot());
			ctx.effect(() => form.subscribe(() => {
				store.set(form.getSnapshot());
			}), "dsh-chat-background-settings: settings mirror");
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: SETTINGS_NS,
				label: "背景图与透明度",
				inject: () => ({
					hooks: { backgroundConfig: store },
					save: async (patch) => {
						const entries = Object.entries(patch).filter(([, value]) => value !== void 0);
						return (await Promise.all(entries.map(([field, value]) => form.set(field, value)))).every(Boolean);
					},
					reset: (field) => form.unset(field)
				})
			}, BackgroundCard));
		}
		/**
		* 本插件那张卡片。页签把各家的卡片放进一个列表，所以最外层是 li。
		* 输入全部来自 props：inject 里 hooks 的 backgroundConfig 被渲染器绑成
		* useBackgroundConfig，两个回调直接是 inject 返回的成员。
		* @param props - 快照选择器与写回调。
		* @returns 卡片，或（Host 不再服务这个 namespace 时）什么都不渲染。
		*/
		function BackgroundCard(props) {
			const state = props.useBackgroundConfig((snapshot) => snapshot);
			const [message, setMessage] = (0, react.useState)("");
			if (state.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: "正在读取当前配置…" });
			if (state.status === "unavailable") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "背景图与透明度" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => {
					event.preventDefault();
					const data = new FormData(event.currentTarget);
					const patch = {
						image: String(data.get("image")),
						opacity: Number(data.get("opacity"))
					};
					props.save(patch).then((ok) => {
						setMessage(ok ? "已保存：刷新页面看新背景。" : "保存被拒绝：值不合法，或配置刚在别处被改过。");
					});
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["背景图路径 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						name: "image",
						size: 40,
						defaultValue: state.value?.image
					})] }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["透明度（0–1） ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						name: "opacity",
						type: "number",
						min: 0,
						max: 1,
						step: .05,
						defaultValue: state.value?.opacity
					})] }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: !state.writable,
						children: "保存"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: !state.writable,
						onClick: () => {
							props.reset("opacity");
						},
						children: "重置透明度"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: message })
				]
			}, String(state.revision))] });
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map