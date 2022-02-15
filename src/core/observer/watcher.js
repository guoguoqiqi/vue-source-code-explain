/* @flow */

import {
	warn,
	remove,
	isObject,
	parsePath,
	_Set as Set,
	handleError,
	invokeWithErrorHandling,
	noop,
} from "../util/index";

import { traverse } from "./traverse";
import { queueWatcher } from "./scheduler";
import Dep, { pushTarget, popTarget } from "./dep";

import type { SimpleSet } from "../util/index";

let uid = 0;

/**
 * 就把Watcher叫做依赖吧，也可以称之为订阅者
 */
export default class Watcher {
	vm: Component;
	expression: string;
	cb: Function;
	id: number;
	deep: boolean;
	user: boolean;
	lazy: boolean;
	sync: boolean;
	dirty: boolean;
	active: boolean;
	deps: Array<Dep>;
	newDeps: Array<Dep>;
	depIds: SimpleSet;
	newDepIds: SimpleSet;
	before: ?Function;
	getter: Function;
	value: any;

	constructor(
		vm: Component,
		expOrFn: string | Function,
		cb: Function,
		options?: ?Object,
		isRenderWatcher?: boolean
	) {
		this.vm = vm;
		if (isRenderWatcher) {
			vm._watcher = this;
		}

		// 将所有的watcher添加到实例的_watchers数组中
		vm._watchers.push(this);

		//其它选项，深度监听deep
		if (options) {
			this.deep = !!options.deep;
			this.user = !!options.user;
			this.lazy = !!options.lazy;
			this.sync = !!options.sync;
			this.before = options.before;
		} else {
			this.deep = this.user = this.lazy = this.sync = false;
		}

		// 回调函数，一般是用户传入的handler方法
		this.cb = cb;

		// watcher唯一标识
		this.id = ++uid;

		// 活跃状态
		this.active = true;

		//如果dirty为true，则重新计算，反之不进行计算，懒惰模式？
		this.dirty = this.lazy;

		// 用于存放自己订阅了哪个依赖收集器，Dep
		this.deps = [];
		this.newDeps = [];
		this.depIds = new Set();
		this.newDepIds = new Set();
		this.expression =
			process.env.NODE_ENV !== "production" ? expOrFn.toString() : "";

		if (typeof expOrFn === "function") {
			// 计算值的方法
			this.getter = expOrFn;
		} else {
			this.getter = parsePath(expOrFn);
			if (!this.getter) {
				this.getter = noop;
				process.env.NODE_ENV !== "production" &&
					warn(
						`Failed watching path: "${expOrFn}" ` +
							"Watcher only accepts simple dot-delimited paths. " +
							"For full control, use a function instead.",
						vm
					);
			}
		}
		// 执行get方法时，会执行pushTarget(this)
		// 这一步就使得 Dep.target = this，也就是往全局的依赖栈里面推入了当前的自己（watcher）
		this.value = this.lazy ? undefined : this.get();
	}

	/**
	 * 计算值，并重新收集依赖项
	 */
	get() {
		// 将自己推入全局那个订阅者栈 targetStack，因为当前自己正在执行
		pushTarget(this);
		let value;
		const vm = this.vm;
		try {
			// 调用getter计算值
			value = this.getter.call(vm, vm);
		} catch (e) {
			if (this.user) {
				handleError(e, vm, `getter for watcher "${this.expression}"`);
			} else {
				throw e;
			}
		} finally {
			// "touch" every property so they are all tracked as
			// dependencies for deep watching
			if (this.deep) {
				// 深入遍历获取到的值，进行依赖收集，具体进入 traverse 方法查看
				traverse(value);
			}
			popTarget();
			this.cleanupDeps();
		}
		return value;
	}

	/**
	 * 添加依赖的动作，对应Dep构造函数中的depend
	 */
	addDep(dep: Dep) {
		// 这里就是判断是否已经被某个Dep添加过，避免重复添加
		const id = dep.id;
		if (!this.newDepIds.has(id)) {
			this.newDepIds.add(id);
			this.newDeps.push(dep);
			if (!this.depIds.has(id)) {
				dep.addSub(this);
			}
		}
	}

	/**
	 * Clean up for dependency collection.
	 */
	cleanupDeps() {
		let i = this.deps.length;
		while (i--) {
			const dep = this.deps[i];
			if (!this.newDepIds.has(dep.id)) {
				dep.removeSub(this);
			}
		}
		let tmp = this.depIds;
		this.depIds = this.newDepIds;
		this.newDepIds = tmp;
		this.newDepIds.clear();
		tmp = this.deps;
		this.deps = this.newDeps;
		this.newDeps = tmp;
		this.newDeps.length = 0;
	}

	/**
	 * 依赖项变化，触发update方法
	 */
	update() {
		if (this.lazy) {
			// 这个lazy也对应了computedwatcher ，如果依赖更细，那么更新dirty为true，以触发computed的重新计算
			this.dirty = true;
		} else if (this.sync) {
			this.run();
		} else {
			queueWatcher(this);
		}
	}

	/**
	 * 实际调用用户传入的cb回调函数的方法
	 */
	run() {
		if (this.active) {
			const value = this.get();
			// 这里可以看出先是 执行this.get 获取到最新的值 作为新值value
			// 然后获取到保存的 this.value 作为oldValue
			// 最后触发 this.cb.call(this.vm, value, oldValue)
			// 因此这也是对应了我们使用watch时，handler方法里可以接收两个参数，第一个是新值，第二个是旧值
			if (value !== this.value || isObject(value) || this.deep) {
				const oldValue = this.value;
				this.value = value;
				if (this.user) {
					const info = `callback for watcher "${this.expression}"`;
					invokeWithErrorHandling(
						this.cb,
						this.vm,
						[value, oldValue],
						this.vm,
						info
					);
				} else {
					this.cb.call(this.vm, value, oldValue);
				}
			}
		}
	}

	/**
	 * 计算值
	 */
	evaluate() {
		// 对应createComputedGetter里面的evaluate方法
		// 先计算值
		// 后更新dirty为false
		this.value = this.get();
		this.dirty = false;
	}

	/**
	 * 意思是假如a属性依赖于b属性，那么会将b属性的所有依赖添加到a身上
	 */
	// 遍历这个watcher里面的所有dep 也就是自己订阅了的那个Dep
	// 然后执行Dep的depend方法 里面做了这件事 （ Dep.target.addDep(this) ）
	depend() {
		let i = this.deps.length;
		while (i--) {
			this.deps[i].depend();
		}
	}

	/**
	 * Remove self from all dependencies' subscriber list.
	 */
	teardown() {
		if (this.active) {
			// 判断如果实例vm还没有开始卸载，那就移除_watchers
			if (!this.vm._isBeingDestroyed) {
				remove(this.vm._watchers, this);
			}

			//遍历移除所有依赖项
			let i = this.deps.length;
			while (i--) {
				this.deps[i].removeSub(this);
			}
			this.active = false;
		}
	}
}
