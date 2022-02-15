/* @flow */
/**
 * 这个文件是给Vue挂载全局方法，也就是Vue本身上有的东西(Vue.xxx，而非原型上，所以不是Vue.prototype.xxx)
 * 按照导入的顺序分别有以下方法
 * 1. Vue.config.xxx --- Vue的全局配置，包括日志警告、忽略自定义元素等
 * 2. Vue.use        --- 常用的安装插件的方法，内部执行传入的函数或者传入的对象的install方法
 * 3. Vue.mixin      --- 常用的混入方法，可全局混入Vue.mixin，也可在单文件中通过 mixin: [] 引入，内部就是执行了选项合并
 * 4. Vue.extend     --- 构建Vue的子类，这个方法还是有点意思的，具体进入方法查看
 * 5. Vue.component、Vue.derective、Vue.filter      --- 注册全局组件、指令、过滤器方法
 * 6. Vue.set、 Vue.del   --- 很常用，主要是针对数组下标、长度，对象添加删除属性，触发视图更新
 * 7. Vue.options.components、Vue.options.directives、Vue.options.filters   --- 初始化这三个初始选项为{}
 * 8. KeepAlive      --- 向上面Vue.options.components中添加一个Vue提供的全局组件 KeepAlive
 * 9. Vue.observe    --- 创建响应式数据的方法，可用于创建一个小型的状态管理
 */

import config from "../config";
import { initUse } from "./use";
import { initMixin } from "./mixin";
import { initExtend } from "./extend";
import { initAssetRegisters } from "./assets";
import { set, del } from "../observer/index";
import { ASSET_TYPES } from "shared/constants";
import builtInComponents from "../components/index";
import { observe } from "core/observer/index";

import {
	warn,
	extend,
	nextTick,
	mergeOptions,
	defineReactive,
} from "../util/index";

export function initGlobalAPI(Vue: GlobalAPI) {
	const configDef = {};
	configDef.get = () => config;
	if (process.env.NODE_ENV !== "production") {
		configDef.set = () => {
			warn(
				"Do not replace the Vue.config object, set individual fields instead."
			);
		};
	}
	// 全局配置信息
	Object.defineProperty(Vue, "config", configDef);

	// Vue内部使用的工具方法，不对外暴露使用
	Vue.util = {
		warn, // 警告方法
		extend, // 合并对象 类似于 Object.assign吧
		mergeOptions, // 合并选项
		defineReactive, // 代理对象，重写getter setter
	};

	// 这三个方法就是在Vue身上挂载几个常用方法 分别是 Vue.set | Vue.delete | Vue.nextTick
	Vue.set = set;
	Vue.delete = del;
	Vue.nextTick = nextTick;

	// 2.6版本新增的方法，用于创建一个响应式的对象，可作为简易的状态管理来使用
	Vue.observable = (obj: T): T => {
		observe(obj);
		return obj;
	};

	// 初始化Vue选项 options，先是创建一个空对象，然后分别添加
	// 组件选项  Vue.options.components = {}
	// 指令选项  Vue.options.directives = {}
	// 过滤器选项 Vue.options.filters = {}
	Vue.options = Object.create(null);
	ASSET_TYPES.forEach((type) => {
		Vue.options[type + "s"] = Object.create(null);
	});

	Vue.options._base = Vue;

	// 将 KeepAlive 组件 添加到 上面刚创建的Vue.options.components 中
	// 其实就是挂载了一个全局组件 KeepAlive，也是我们常用的一个全局组件
	extend(Vue.options.components, builtInComponents);

	// 创建Vue.use方法，用于安装插件的那个方法
	initUse(Vue);

	// 创建Vue.mixin方法，注册全局混入的那个方法
	initMixin(Vue);

	// 创建Vue.extend方法，Vue子类构造器，用于创建一个Vue的子类
	initExtend(Vue);

	// 创建 Vue.component 全局注册组件方法
	// 创建 Vue.directive 全局注册指令方法
	// 创建 Vue.filter    全局注册过滤器方法
	initAssetRegisters(Vue);
}
