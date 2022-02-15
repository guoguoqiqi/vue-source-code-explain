/* @flow */

import { toArray } from "../util/index";

// 定义了Vue.use 方法，用于安装插件
export function initUse(Vue: GlobalAPI) {
	Vue.use = function (plugin: Function | Object) {
		const installedPlugins =
			this._installedPlugins || (this._installedPlugins = []);

		// 避免重复安装同一个插件
		if (installedPlugins.indexOf(plugin) > -1) {
			return this;
		}

		const args = toArray(arguments, 1);
		args.unshift(this);
		// 可以看出，如果Vue.use传入的是一个对象，那么会执行他的install方法
		if (typeof plugin.install === "function") {
			plugin.install.apply(plugin, args);
		} else if (typeof plugin === "function") {
			// 如果传入的就是一个函数，那么直接执行这个函数
			plugin.apply(null, args);
		}
		// 缓存已经安装过的插件，避免重复安装
		installedPlugins.push(plugin);
		return this;
	};
}
