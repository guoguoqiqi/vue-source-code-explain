/* @flow */

import type Watcher from "./watcher";
import { remove } from "../util/index";
import config from "../config";

let uid = 0;

/**
 * 对于每一个响应式的数据都需要这么一个依赖收集器，用于收集依赖自己的所有依赖者
 */
export default class Dep {
	static target: ?Watcher;
	id: number;
	subs: Array<Watcher>;

	constructor() {
		// 每个依赖收集器的唯一标识
		this.id = uid++;
		// 盛放依赖的容器
		this.subs = [];
	}

	// 添加订阅者，也就是添加一个依赖
	addSub(sub: Watcher) {
		this.subs.push(sub);
	}

	// 移除订阅者
	removeSub(sub: Watcher) {
		remove(this.subs, sub);
	}

	// 这里对应 initData方法中 ，Object.defineProperty 中 get 方法的 dep.depend()
	// 意思是如果存在Dep.target 则调用Dep.target的addDep方法并且将自己作为参数传入
	// 首先： Dep.target 其实就是 Watcher 的实例，其实也就是那个依赖
	// 而之所以 添加依赖的动作由依赖间接完成，是因为 每个Dep 可能添加多个依赖，同样，每个依赖也可能被多个Dep添加
	// 因此Watcher需要保存自己被哪些Dep添加过，判断方式就是Dep的id，作用是避免重复添加
	depend() {
		if (Dep.target) {
			Dep.target.addDep(this);
		}
	}

	// 通知所有订阅者执行update方法
	notify() {
		const subs = this.subs.slice();
		if (process.env.NODE_ENV !== "production" && !config.async) {
			subs.sort((a, b) => a.id - b.id);
		}
		for (let i = 0, l = subs.length; i < l; i++) {
			subs[i].update();
		}
	}
}

// 当前正在执行的订阅者 watcher 全局就一个
Dep.target = null;
// 订阅者栈
const targetStack = [];

// 当前有新的依赖出现，那么作为订阅者入栈，并且将当前全局的那个正在执行的watcher指向它
export function pushTarget(target: ?Watcher) {
	targetStack.push(target);
	Dep.target = target;
}

// 订阅者出栈，并且将当前全局的那个正在执行的watcher指向订阅者栈的栈顶
export function popTarget() {
	targetStack.pop();
	Dep.target = targetStack[targetStack.length - 1];
}
