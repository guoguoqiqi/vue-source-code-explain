/* @flow */

import { hasOwn } from "shared/util";
import { warn, hasSymbol } from "../util/index";
import { defineReactive, toggleObserving } from "../observer/index";

export function initProvide(vm: Component) {
	// 获取选项中的provide属性
	const provide = vm.$options.provide;

	// 给实例添加一个_provided属性
	// 由于用户传入的有可能是函数，如果是那么执行这个函数
	if (provide) {
		vm._provided = typeof provide === "function" ? provide.call(vm) : provide;
	}
}

export function initInjections(vm: Component) {
	// 获取当前实例选项中的inject，通过 resolveInject 方法 迭代其$parent属性，不断的寻找provide，如果没找到
	// 那么说明没有父组件给当前实例提供，报错 inject xxx not found 下面的resolveInject方法思路很清晰
	const result = resolveInject(vm.$options.inject, vm);
	if (result) {
		toggleObserving(false);
		Object.keys(result).forEach((key) => {
			/* istanbul ignore else */
			if (process.env.NODE_ENV !== "production") {
				defineReactive(vm, key, result[key], () => {
					warn(
						`Avoid mutating an injected value directly since the changes will be ` +
							`overwritten whenever the provided component re-renders. ` +
							`injection being mutated: "${key}"`,
						vm
					);
				});
			} else {
				defineReactive(vm, key, result[key]);
			}
		});
		toggleObserving(true);
	}
}

export function resolveInject(inject: any, vm: Component): ?Object {
	if (inject) {
		// inject is :any because flow is not smart enough to figure out cached
		const result = Object.create(null);
		const keys = hasSymbol ? Reflect.ownKeys(inject) : Object.keys(inject);

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			// #6574 in case the inject object is observed...
			if (key === "__ob__") continue;
			const provideKey = inject[key].from;
			let source = vm;
			while (source) {
				if (source._provided && hasOwn(source._provided, provideKey)) {
					result[key] = source._provided[provideKey];
					break;
				}
				source = source.$parent;
			}
			if (!source) {
				if ("default" in inject[key]) {
					const provideDefault = inject[key].default;
					result[key] =
						typeof provideDefault === "function"
							? provideDefault.call(vm)
							: provideDefault;
				} else if (process.env.NODE_ENV !== "production") {
					warn(`Injection "${key}" not found`, vm);
				}
			}
		}
		return result;
	}
}
