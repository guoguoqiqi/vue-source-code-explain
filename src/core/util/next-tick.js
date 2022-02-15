/* @flow */
/* globals MutationObserver */

import { noop } from "shared/util";
import { handleError } from "./error";
import { isIE, isIOS, isNative } from "./env";

export let isUsingMicroTask = false;

// 全局的一个回调事件队列
const callbacks = [];
let pending = false;

// 取出callbacks中的所有事件，挨个执行
function flushCallbacks() {
	pending = false;
	const copies = callbacks.slice(0);
	callbacks.length = 0;
	for (let i = 0; i < copies.length; i++) {
		copies[i]();
	}
}

let timerFunc;

// callbacks事件队列执行方式
// 第一种 Promise，如果支持Promise，那就利用Promise将事件队列里的事件推入微任务队列
// 第二种 MutationObserver 这个方法是用于监测Dom树的变化，如果Dom树发生变化，可以触发回调函数，也是微任务
// 第三种 setImmediate 立即执行，可代替 setTimeout(cb, 0) 属于宏任务
// 第四种 setTimeout 如果上述都不支持，那就用setTimeout 也属于宏任务
if (typeof Promise !== "undefined" && isNative(Promise)) {
	const p = Promise.resolve();
	timerFunc = () => {
		p.then(flushCallbacks);
		if (isIOS) setTimeout(noop);
	};
	isUsingMicroTask = true;
} else if (
	!isIE &&
	typeof MutationObserver !== "undefined" &&
	(isNative(MutationObserver) ||
		MutationObserver.toString() === "[object MutationObserverConstructor]")
) {
	let counter = 1;
	const observer = new MutationObserver(flushCallbacks);
	const textNode = document.createTextNode(String(counter));
	observer.observe(textNode, {
		characterData: true,
	});
	timerFunc = () => {
		counter = (counter + 1) % 2;
		textNode.data = String(counter);
	};
	isUsingMicroTask = true;
} else if (typeof setImmediate !== "undefined" && isNative(setImmediate)) {
	timerFunc = () => {
		setImmediate(flushCallbacks);
	};
} else {
	timerFunc = () => {
		setTimeout(flushCallbacks, 0);
	};
}

// 看看nextTick方法做了什么
// 接收两个参数，第一个是回调函数、第二个是上下文对象
export function nextTick(cb?: Function, ctx?: Object) {
	let _resolve;

	// 如果传入了回调函数，那么这个回调函数会被添加到那个callbacks事件队列中去
	// 如果没有传入回调函数，那么会将一个Promise对象添加进去
	callbacks.push(() => {
		if (cb) {
			try {
				cb.call(ctx);
			} catch (e) {
				handleError(e, ctx, "nextTick");
			}
		} else if (_resolve) {
			_resolve(ctx);
		}
	});
	if (!pending) {
		pending = true;
		timerFunc();
	}
	// $flow-disable-line
	if (!cb && typeof Promise !== "undefined") {
		return new Promise((resolve) => {
			_resolve = resolve;
		});
	}
}
