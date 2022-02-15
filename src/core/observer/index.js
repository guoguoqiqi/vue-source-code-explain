/* @flow */

import Dep from "./dep";
import VNode from "../vdom/vnode";
import { arrayMethods } from "./array";
import {
	def,
	warn,
	hasOwn,
	hasProto,
	isObject,
	isPlainObject,
	isPrimitive,
	isUndef,
	isValidArrayIndex,
	isServerRendering,
} from "../util/index";

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true;

export function toggleObserving(value: boolean) {
	shouldObserve = value;
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
	value: any;
	dep: Dep;
	vmCount: number; // number of vms that have this object as root $data

	constructor(value: any) {
		this.value = value;
		this.dep = new Dep();
		this.vmCount = 0;

		// 给所有将要变成响应式的值加一个__ob__属性，也就是响应式的标志
		def(value, "__ob__", this);

		// 判断是否是数组，是的话调用数组的处理方法
		if (Array.isArray(value)) {
			if (hasProto) {
				protoAugment(value, arrayMethods);
			} else {
				copyAugment(value, arrayMethods, arrayKeys);
			}
			this.observeArray(value);
		} else {
			this.walk(value);
		}
	}

	/**
	 * Walk through all properties and convert them into
	 * getter/setters. This method should only be called when
	 * value type is Object.
	 */
	walk(obj: Object) {
		const keys = Object.keys(obj);
		for (let i = 0; i < keys.length; i++) {
			// 遍历这个对象，将其变成响应式
			defineReactive(obj, keys[i]);
		}
	}

	/**
	 * Observe a list of Array items.
	 */
	observeArray(items: Array<any>) {
		for (let i = 0, l = items.length; i < l; i++) {
			observe(items[i]);
		}
	}
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
	/* eslint-disable no-proto */
	target.__proto__ = src;
	/* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i];
		def(target, key, src[key]);
	}
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
	if (!isObject(value) || value instanceof VNode) {
		return;
	}
	let ob: Observer | void;
	// __ob__ 这个属性代表这个值是响应式的，这里判断如果已经是响应式的则无需处理
	if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
		ob = value.__ob__;
	} else if (
		shouldObserve &&
		!isServerRendering() &&
		(Array.isArray(value) || isPlainObject(value)) &&
		Object.isExtensible(value) &&
		!value._isVue
	) {
		// 响应式入口 new Observer()
		ob = new Observer(value);
	}
	if (asRootData && ob) {
		ob.vmCount++;
	}
	return ob;
}

/**
 * 将对象中的某个 key 变成响应式的方法，Object.defineProperty 重写 getter setter
 */
export function defineReactive(
	obj: Object,
	key: string,
	val: any,
	customSetter?: ?Function,
	shallow?: boolean
) {
	// 创建一个依赖收集器
	const dep = new Dep();

	// 获取对象中目标key的属性修饰符，如果 configurable 为false说明改属性不可更改，因此无法响应式，直接退出
	const property = Object.getOwnPropertyDescriptor(obj, key);
	if (property && property.configurable === false) {
		return;
	}

	// 获取该属性本身已有的getter和setter方法
	const getter = property && property.get;
	const setter = property && property.set;
	if ((!getter || setter) && arguments.length === 2) {
		val = obj[key];
	}

	// shallow 代表是否是浅层检测，如果不是浅层那么需要 observe(val)
	let childOb = !shallow && observe(val);
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function reactiveGetter() {
			// 利用该属性原有的 getter 获取值
			const value = getter ? getter.call(obj) : val;

			// 以下就是依赖收集的关键
			// 意为：当获取这个对象的这个属性值的时候，回去判断是否存在 Dep.target，存在的话则进行依赖收集
			// 第一次获取的时候是 Vue第一次向页面上挂载元素的时候，这个时候，当获取了这个属性时，会触发一次new Watcher
			// 这次new Watcher 就是一个依赖，代表页面上某个地方的显示依赖了这个属性值
			// new Watcher 时，就会执行 Dep.target = this 这个操作，因此会触发下面的依赖收集
			if (Dep.target) {
				// 依赖收集的动作，具体前往Dep的构造函数中查看
				dep.depend();

				// 这里判断也是深层检测
				if (childOb) {
					childOb.dep.depend();
					if (Array.isArray(value)) {
						dependArray(value);
					}
				}
			}
			return value;
		},
		set: function reactiveSetter(newVal) {
			// 也是用该属性原有的getter获取值
			const value = getter ? getter.call(obj) : val;
			// 判断新赋的值与旧值是否相同，相同就退出
			if (newVal === value || (newVal !== newVal && value !== value)) {
				return;
			}

			if (process.env.NODE_ENV !== "production" && customSetter) {
				customSetter();
			}

			if (getter && !setter) return;

			// 如果该属性原有setter，那么就调用setter，否则直接赋值
			if (setter) {
				setter.call(obj, newVal);
			} else {
				val = newVal;
			}

			// 如果赋的值需要深层检测，那么也将其变成响应式
			childOb = !shallow && observe(newVal);

			// Dep调用notify方法，通知所有依赖
			dep.notify();
		},
	});
}

/**
 * 在Vue全局上挂载set方法，该方法以及下面的del方法常用于 解决 无法通过数组下标改变数据更新视图以及给一个对象添加属性或者删除属性更新视图的 问题
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
	if (
		process.env.NODE_ENV !== "production" &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(
			`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
		);
	}
	// 判断如果是目标是数据 并且传入的key是一个数组下标
	// 那么执行数组的splice方法，由于Vue重写了splice方法，因此可以触发更新
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.length = Math.max(target.length, key);
		target.splice(key, 1, val);
		return val;
	}
	// 判断如果目标是对象，并且key已经存在于这个对象，那么很简单，直接改变该属性就好，自动会触发set方法
	if (key in target && !(key in Object.prototype)) {
		target[key] = val;
		return val;
	}
	const ob = (target: any).__ob__;
	// 这里是禁止向Vue实例或者实例的$data属性身上直接添加属性
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== "production" &&
			warn(
				"Avoid adding reactive properties to a Vue instance or its root $data " +
					"at runtime - declare it upfront in the data option."
			);
		return val;
	}
	// 如果目标对象不是响应式的，那么无需多言，直接该表属性值 返回即可
	if (!ob) {
		target[key] = val;
		return val;
	}
	// 如果是响应式的对象，那么要主动重写这个新的属性的get、set，将其变为响应式
	defineReactive(ob.value, key, val);
	// 并且主动触发一次视图更新
	ob.dep.notify();
	return val;
}

/**
 * 在Vue全局上挂载del方法，该方法和上面的set如出一辙，用法和实现原理一样
 */
export function del(target: Array<any> | Object, key: any) {
	if (
		process.env.NODE_ENV !== "production" &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(
			`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
		);
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.splice(key, 1);
		return;
	}
	const ob = (target: any).__ob__;
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== "production" &&
			warn(
				"Avoid deleting properties on a Vue instance or its root $data " +
					"- just set it to null."
			);
		return;
	}
	if (!hasOwn(target, key)) {
		return;
	}
	delete target[key];
	if (!ob) {
		return;
	}
	ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
	for (let e, i = 0, l = value.length; i < l; i++) {
		e = value[i];
		e && e.__ob__ && e.__ob__.dep.depend();
		if (Array.isArray(e)) {
			dependArray(e);
		}
	}
}
