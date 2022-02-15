/* @flow */

import { no, noop, identity } from "shared/util";

import { LIFECYCLE_HOOKS } from "shared/constants";

// Vue的一些全局配置项，可到官网查看具体含义
export type Config = {
	// user
	optionMergeStrategies: { [key: string]: Function },
	silent: boolean,
	productionTip: boolean,
	performance: boolean,
	devtools: boolean,
	errorHandler: ?(err: Error, vm: Component, info: string) => void,
	warnHandler: ?(msg: string, vm: Component, trace: string) => void,
	ignoredElements: Array<string | RegExp>,
	keyCodes: { [key: string]: number | Array<number> },

	// platform
	isReservedTag: (x?: string) => boolean,
	isReservedAttr: (x?: string) => boolean,
	parsePlatformTagName: (x: string) => string,
	isUnknownElement: (x?: string) => boolean,
	getTagNamespace: (x?: string) => string | void,
	mustUseProp: (tag: string, type: ?string, name: string) => boolean,

	// private
	async: boolean,

	// legacy
	_lifecycleHooks: Array<string>,
};

export default ({
	/**
	 * Option merge strategies (used in core/util/options)
	 */
	// 自定义合并策略的选项
	optionMergeStrategies: Object.create(null),

	// 取消 Vue 所有的日志与警告。
	silent: false,

	// 设置为 false 以阻止 vue 在启动时生成生产提示
	productionTip: process.env.NODE_ENV !== "production",

	// 配置是否允许 vue-devtools 检查代码。开发版本默认为 true，生产版本默认为 false。生产版本设为 true 可以启用检查
	devtools: process.env.NODE_ENV !== "production",

	// 设置为 true 以在浏览器开发工具的性能/时间线面板中启用对组件初始化、编译、渲染和打补丁的性能追踪
	performance: false,

	// 指定组件的渲染和观察期间未捕获错误的处理函数
	errorHandler: null,

	// 为 Vue 的运行时警告赋予一个自定义处理函数。注意这只会在开发者环境下生效，在生产环境下它会被忽略。
	warnHandler: null,

	// Vue 忽略在 Vue 之外的自定义元素，举个例子，你在代码里使用了<my-dialog></my-dialog>，vue会认为这是一个组件，除非在ignoredElements配置了，那就可以忽略它
	ignoredElements: [],

	// 给 v-on 自定义键位别名
	keyCodes: Object.create(null),

	/**
	 * Check if a tag is reserved so that it cannot be registered as a
	 * component. This is platform-dependent and may be overwritten.
	 */
	isReservedTag: no,

	/**
	 * Check if an attribute is reserved so that it cannot be used as a component
	 * prop. This is platform-dependent and may be overwritten.
	 */
	isReservedAttr: no,

	/**
	 * Check if a tag is an unknown element.
	 * Platform-dependent.
	 */
	isUnknownElement: no,

	/**
	 * Get the namespace of an element
	 */
	getTagNamespace: noop,

	/**
	 * Parse the real tag name for the specific platform.
	 */
	parsePlatformTagName: identity,

	/**
	 * Check if an attribute must be bound using property, e.g. value
	 * Platform-dependent.
	 */
	mustUseProp: no,

	/**
	 * Perform updates asynchronously. Intended to be used by Vue Test Utils
	 * This will significantly reduce performance if set to false.
	 */
	async: true,

	/**
	 * Exposed for legacy reasons
	 */
	_lifecycleHooks: LIFECYCLE_HOOKS,
}: Config);
