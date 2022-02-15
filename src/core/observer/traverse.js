/* @flow */

import { _Set as Set, isObject } from "../util/index";
import type { SimpleSet } from "../util/index";
import VNode from "../vdom/vnode";

const seenObjects = new Set();

/**
 * 深度遍历数组或者对象，收集每个值的依赖
 */
export function traverse(val: any) {
	_traverse(val, seenObjects);
	seenObjects.clear();
}

function _traverse(val: any, seen: SimpleSet) {
	let i, keys;
	const isA = Array.isArray(val);

	// 如果不是数组、对象 直接退出
	if (
		(!isA && !isObject(val)) ||
		Object.isFrozen(val) ||
		val instanceof VNode
	) {
		return;
	}

	// 如果当前值存在__ob__属性，也就是当前值是响应式的，那么将其依赖收集器的id添加到seenObjects中
	if (val.__ob__) {
		const depId = val.__ob__.dep.id;
		if (seen.has(depId)) {
			return;
		}
		seen.add(depId);
	}

	// 如果该值是数组，循环遍历每一项进行递归收集依赖项
	if (isA) {
		i = val.length;
		while (i--) _traverse(val[i], seen);
	} else {
		// 如果该值时对象，遍历所有属性递归收集依赖项
		keys = Object.keys(val);
		i = keys.length;
		while (i--) _traverse(val[keys[i]], seen);
	}
}
