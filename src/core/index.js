import Vue from "./instance/index";
import { initGlobalAPI } from "./global-api/index";
import { isServerRendering } from "core/util/env";
import { FunctionalRenderContext } from "core/vdom/create-functional-component";

// 初始化一些全局方法
initGlobalAPI(Vue);

Object.defineProperty(Vue.prototype, "$isServer", {
	get: isServerRendering,
});

Object.defineProperty(Vue.prototype, "$ssrContext", {
	get() {
		return this.$vnode && this.$vnode.ssrContext;
	},
});

// 服务端渲染的，忽略
Object.defineProperty(Vue, "FunctionalRenderContext", {
	value: FunctionalRenderContext,
});

Vue.version = "__VERSION__";

export default Vue;
