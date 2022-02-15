/* @flow */

import config from "../config";
import { initProxy } from "./proxy";
import { initState } from "./state";
import { initRender } from "./render";
import { initEvents } from "./events";
import { mark, measure } from "../util/perf";
import { initLifecycle, callHook } from "./lifecycle";
import { initProvide, initInjections } from "./inject";
import { extend, mergeOptions, formatComponentName } from "../util/index";

let uid = 0;

export function initMixin(Vue: Class<Component>) {
	Vue.prototype._init = function (options?: Object) {
		const vm: Component = this;
		// 每个Vue实例都有一个唯一标识uid，累加创建
		vm._uid = uid++;

		let startTag, endTag;
		if (process.env.NODE_ENV !== "production" && config.performance && mark) {
			startTag = `vue-perf-start:${vm._uid}`;
			endTag = `vue-perf-end:${vm._uid}`;
			mark(startTag);
		}

		vm._isVue = true;
		if (options && options._isComponent) {
			// 判断如果是组件，那么特殊处理
			initInternalComponent(vm, options);
		} else {
			// 这个位置开始为Vue实例创建选项$options了 vm代表Vue实例
			// --------选项合并----------
			// vm.constructor 也就是实例的构造器，也就是Vue
			vm.$options = mergeOptions(
				resolveConstructorOptions(vm.constructor),
				options || {},
				vm
			);
			// 反正经过 mergeOptions 后，实例传入的 data、props、components、等选项就和Vue身上默认的选项合并起来了
			// 最终合并到了实例的 $options 身上
		}
		// 到这里属性合并也就结束了，下面才开始真正的对这个实例进行各种初始化操作

		if (process.env.NODE_ENV !== "production") {
			initProxy(vm);
		} else {
			vm._renderProxy = vm;
		}
		vm._self = vm;
		// 首先给初始化生命周期的几个属性，并且将$parent $children $refs 属性添加到实例身上
		// 经过这一步实例的身上多了如下几个属性
		//  --- $children: []
		//  --- $parent: undefined
		//  --- $refs: {}
		//  --- $root: Vue {_uid: 1, _isVue: true, $options: {…}, _renderProxy: Proxy, _self: Vue, …}
		//  --- _directInactive: false
		//  --- _inactive: null
		//  --- _isBeingDestroyed: false
		//  --- _isDestroyed: false
		//  --- _isMounted: false
		initLifecycle(vm);

		// 添加事件方法
		initEvents(vm);

		// 给实例添加render相关方法 vm.$createElement | vm._c
		// 以及添加插槽相关属性 vm.$slots | vm.$scopedSlots
		// 以及添加两个常用的通信属性 vm.$attrs | vm.$listeners
		initRender(vm);

		// 这就是执行第一个钩子函数的时机
		// 可以看下现在实例 vm 身上的属性，可以知道目前vm身上是没有用户定义的data、methods里面的内容的
		// 因为还没代理到实例身上，目前还在$options身上
		// 因此这也是为什么使用Vue时，不能在这个钩子函数里面使用this.xxx 去获取data里面的数据或者调用methods里的方法
		callHook(vm, "beforeCreate");

		// 初始化实例的inject 注入属性，（在初始化props和data之前）
		initInjections(vm);

		// 重点来了呀 ---------------
		// 这一步初始化用户传入的状态 props | methods | data | computed | watch
		// 这一步相当于是开始构建响应式系统
		// 将以上选项进行Object.defineProperty 重写
		initState(vm);

		// 初始化实例的provide 提供属性，（在初始化props和data之后）
		initProvide(vm);

		// 初始化完成provide后，那么这个时候到了生命周期钩子中created的执行时机了，初始化工作已完成，下面开始挂载了
		callHook(vm, "created");

		/* istanbul ignore if */
		if (process.env.NODE_ENV !== "production" && config.performance && mark) {
			vm._name = formatComponentName(vm, false);
			mark(endTag);
			measure(`vue ${vm._name} init`, startTag, endTag);
		}

		// 判断是否穿了el属性，如果有那么开始挂载工作，也就是渲染页面了
		if (vm.$options.el) {
			vm.$mount(vm.$options.el);
		}
	};
}

export function initInternalComponent(
	vm: Component,
	options: InternalComponentOptions
) {
	const opts = (vm.$options = Object.create(vm.constructor.options));
	// doing this because it's faster than dynamic enumeration.
	const parentVnode = options._parentVnode;
	opts.parent = options.parent;
	opts._parentVnode = parentVnode;

	const vnodeComponentOptions = parentVnode.componentOptions;
	opts.propsData = vnodeComponentOptions.propsData;
	opts._parentListeners = vnodeComponentOptions.listeners;
	opts._renderChildren = vnodeComponentOptions.children;
	opts._componentTag = vnodeComponentOptions.tag;

	if (options.render) {
		opts.render = options.render;
		opts.staticRenderFns = options.staticRenderFns;
	}
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
	let options = Ctor.options;
	if (Ctor.super) {
		const superOptions = resolveConstructorOptions(Ctor.super);
		const cachedSuperOptions = Ctor.superOptions;
		if (superOptions !== cachedSuperOptions) {
			// super option changed,
			// need to resolve new options.
			Ctor.superOptions = superOptions;
			// check if there are any late-modified/attached options (#4976)
			const modifiedOptions = resolveModifiedOptions(Ctor);
			// update base extend options
			if (modifiedOptions) {
				extend(Ctor.extendOptions, modifiedOptions);
			}
			options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
			if (options.name) {
				options.components[options.name] = Ctor;
			}
		}
	}
	return options;
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
	let modified;
	const latest = Ctor.options;
	const sealed = Ctor.sealedOptions;
	for (const key in latest) {
		if (latest[key] !== sealed[key]) {
			if (!modified) modified = {};
			modified[key] = latest[key];
		}
	}
	return modified;
}
