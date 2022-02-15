/* @flow */

import {
	tip,
	toArray,
	hyphenate,
	formatComponentName,
	invokeWithErrorHandling,
} from "../util/index";
import { updateListeners } from "../vdom/helpers/index";

// 这个文件是Vue实现的事件发布订阅模式

export function initEvents(vm: Component) {
	// 实例上的 _events 就是存放所有事件的对象
	vm._events = Object.create(null);
	vm._hasHookEvent = false;
	// init parent attached events
	const listeners = vm.$options._parentListeners;
	if (listeners) {
		updateComponentListeners(vm, listeners);
	}
}

let target: any;

function add(event, fn) {
	target.$on(event, fn);
}

function remove(event, fn) {
	target.$off(event, fn);
}

function createOnceHandler(event, fn) {
	const _target = target;
	return function onceHandler() {
		const res = fn.apply(null, arguments);
		if (res !== null) {
			_target.$off(event, onceHandler);
		}
	};
}

export function updateComponentListeners(
	vm: Component,
	listeners: Object,
	oldListeners: ?Object
) {
	target = vm;
	updateListeners(
		listeners,
		oldListeners || {},
		add,
		remove,
		createOnceHandler,
		vm
	);
	target = undefined;
}

export function eventsMixin(Vue: Class<Component>) {
	const hookRE = /^hook:/;

	// 订阅事件的方法
	Vue.prototype.$on = function (
		event: string | Array<string>,
		fn: Function
	): Component {
		const vm: Component = this;

		// 可以订阅多个事件，传入一个数组
		if (Array.isArray(event)) {
			for (let i = 0, l = event.length; i < l; i++) {
				vm.$on(event[i], fn);
			}
		} else {
			// vm._events[event] 为空那就初始化为 [] , 然后把这个方法push进去
			(vm._events[event] || (vm._events[event] = [])).push(fn);
			// optimize hook:event cost by using a boolean flag marked at registration
			// instead of a hash lookup
			if (hookRE.test(event)) {
				vm._hasHookEvent = true;
			}
		}
		return vm;
	};

	// 只触发一次的订阅事件
	Vue.prototype.$once = function (event: string, fn: Function): Component {
		const vm: Component = this;

		// 用一个方法将这个回调包装一下
		// 触发的时候，先取消订阅，再执行，那么以后就不会再触发了呗
		function on() {
			vm.$off(event, on);
			fn.apply(vm, arguments);
		}
		on.fn = fn;
		vm.$on(event, on);
		return vm;
	};

	// 取消订阅事件
	// 逻辑也很简单
	// 可以传入一个数组，也可以是一个字符串，代表去掉订阅多个事件或者一个呗
	// 如果是多个，那就遍历取消，如果没传回调函数，那就是取消所有
	// 取消逻辑：
	//   1.获取订阅该事件的所有回调函数
	//   2.遍历找到要取消的回调函数，执行数组的splice方法将其删除，结束
	Vue.prototype.$off = function (
		event?: string | Array<string>,
		fn?: Function
	): Component {
		const vm: Component = this;
		// all
		if (!arguments.length) {
			vm._events = Object.create(null);
			return vm;
		}
		// array of events
		if (Array.isArray(event)) {
			for (let i = 0, l = event.length; i < l; i++) {
				vm.$off(event[i], fn);
			}
			return vm;
		}
		// specific event
		const cbs = vm._events[event];
		if (!cbs) {
			return vm;
		}
		if (!fn) {
			vm._events[event] = null;
			return vm;
		}
		// specific handler
		let cb;
		let i = cbs.length;
		while (i--) {
			cb = cbs[i];
			if (cb === fn || cb.fn === fn) {
				cbs.splice(i, 1);
				break;
			}
		}
		return vm;
	};

	// 触发订阅事件的所有回调函数执行
	// 获取到订阅该事件的所有回调函数，挨个执行
	Vue.prototype.$emit = function (event: string): Component {
		const vm: Component = this;
		if (process.env.NODE_ENV !== "production") {
			const lowerCaseEvent = event.toLowerCase();
			if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
				tip(
					`Event "${lowerCaseEvent}" is emitted in component ` +
						`${formatComponentName(
							vm
						)} but the handler is registered for "${event}". ` +
						`Note that HTML attributes are case-insensitive and you cannot use ` +
						`v-on to listen to camelCase events when using in-DOM templates. ` +
						`You should probably use "${hyphenate(
							event
						)}" instead of "${event}".`
				);
			}
		}
		let cbs = vm._events[event];
		if (cbs) {
			cbs = cbs.length > 1 ? toArray(cbs) : cbs;
			const args = toArray(arguments, 1);
			const info = `event handler for "${event}"`;
			for (let i = 0, l = cbs.length; i < l; i++) {
				invokeWithErrorHandling(cbs[i], vm, args, vm, info);
			}
		}
		return vm;
	};
}
