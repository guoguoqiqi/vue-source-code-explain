/* @flow */

import config from "../config";
import Watcher from "../observer/watcher";
import Dep, { pushTarget, popTarget } from "../observer/dep";
import { isUpdatingChildComponent } from "./lifecycle";

import {
	set,
	del,
	observe,
	defineReactive,
	toggleObserving,
} from "../observer/index";

import {
	warn,
	bind,
	noop,
	hasOwn,
	hyphenate,
	isReserved,
	handleError,
	nativeWatch,
	validateProp,
	isPlainObject,
	isServerRendering,
	isReservedAttribute,
	invokeWithErrorHandling,
} from "../util/index";

const sharedPropertyDefinition = {
	enumerable: true,
	configurable: true,
	get: noop,
	set: noop,
};

export function proxy(target: Object, sourceKey: string, key: string) {
	sharedPropertyDefinition.get = function proxyGetter() {
		return this[sourceKey][key];
	};
	sharedPropertyDefinition.set = function proxySetter(val) {
		this[sourceKey][key] = val;
	};
	Object.defineProperty(target, key, sharedPropertyDefinition);
}

export function initState(vm: Component) {
	vm._watchers = [];
	const opts = vm.$options;
	// 1.初始化 props
	if (opts.props) initProps(vm, opts.props);

	// 2.初始化 methods
	if (opts.methods) initMethods(vm, opts.methods);

	// 3.初始化 data
	if (opts.data) {
		initData(vm);
	} else {
		observe((vm._data = {}), true /* asRootData */);
	}

	// 4.初始化 computed
	if (opts.computed) initComputed(vm, opts.computed);

	// 5.初始化 watch
	if (opts.watch && opts.watch !== nativeWatch) {
		initWatch(vm, opts.watch);
	}
}

// 初始化 props
function initProps(vm: Component, propsOptions: Object) {
	// propsOptions 是用户传入的 props 属性
	const propsData = vm.$options.propsData || {};
	// 给实例添加一个 _props 属性，用于存放 props
	const props = (vm._props = {});

	const keys = (vm.$options._propKeys = []);
	const isRoot = !vm.$parent;
	if (!isRoot) {
		toggleObserving(false);
	}
	for (const key in propsOptions) {
		keys.push(key);
		const value = validateProp(key, propsOptions, propsData, vm);
		if (process.env.NODE_ENV !== "production") {
			const hyphenatedKey = hyphenate(key);
			if (
				isReservedAttribute(hyphenatedKey) ||
				config.isReservedAttr(hyphenatedKey)
			) {
				warn(
					`"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
					vm
				);
			}
			defineReactive(props, key, value, () => {
				if (!isRoot && !isUpdatingChildComponent) {
					warn(
						`Avoid mutating a prop directly since the value will be ` +
							`overwritten whenever the parent component re-renders. ` +
							`Instead, use a data or computed property based on the prop's ` +
							`value. Prop being mutated: "${key}"`,
						vm
					);
				}
			});
		} else {
			defineReactive(props, key, value);
		}

		// 代理 将 vm._props 里所有的属性代理到 vm身上，以便于实例直接使用this.xxx 来获取props
		if (!(key in vm)) {
			proxy(vm, `_props`, key);
		}
	}
	toggleObserving(true);
}

// 初始化 data
function initData(vm: Component) {
	// 获取用户传入的data选项
	// 做个判断如果是函数，那么就执行函数得到 返回的那个对象
	let data = vm.$options.data;
	data = vm._data = typeof data === "function" ? getData(data, vm) : data || {};
	// isPlainObject 方法是 Object.prototype.toString的封装，用于判断是否是普通对象
	// 这里判断data是否是个普通对象，不是则报错
	if (!isPlainObject(data)) {
		data = {};
		process.env.NODE_ENV !== "production" &&
			warn(
				"data functions should return an object:\n" +
					"https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function",
				vm
			);
	}
	// proxy data on instance
	const keys = Object.keys(data);
	const props = vm.$options.props;
	const methods = vm.$options.methods;
	let i = keys.length;
	// 这里和上面差不多，也是对data进行一个校验，不能跟methods里面的方法重名、不能跟props里面的属性重名
	while (i--) {
		const key = keys[i];
		if (process.env.NODE_ENV !== "production") {
			if (methods && hasOwn(methods, key)) {
				warn(
					`Method "${key}" has already been defined as a data property.`,
					vm
				);
			}
		}
		if (props && hasOwn(props, key)) {
			process.env.NODE_ENV !== "production" &&
				warn(
					`The data property "${key}" is already declared as a prop. ` +
						`Use prop default value instead.`,
					vm
				);
		} else if (!isReserved(key)) {
			// 这波也是代理 将vm._data 里面的所有属性 代理到 vm 身上
			// 以便于直接使用this.xxx 获取data里面的数据
			// 由于代理是这里设置的，因此上方beforeCreated钩子是无法通过this.xxx获取data里面的数据的
			proxy(vm, `_data`, key);
		}
	}
	// 这一步很关键
	// 这是将data变成响应式，具体进入 observe 方法查看
	observe(data, true /* asRootData */);
}

export function getData(data: Function, vm: Component): any {
	// #7573 disable dep collection when invoking data getters
	pushTarget();
	try {
		return data.call(vm, vm);
	} catch (e) {
		handleError(e, vm, `data()`);
		return {};
	} finally {
		popTarget();
	}
}

const computedWatcherOptions = { lazy: true };

function initComputed(vm: Component, computed: Object) {
	// 创建一个computed依赖收集器，用于存放computed变量依赖的变量
	const watchers = (vm._computedWatchers = Object.create(null));

	const isSSR = isServerRendering();

	// 遍历computed所有的属性
	for (const key in computed) {
		const userDef = computed[key];

		// computed有两种用法，一种是函数写法，一种是对象写法，对象写法的话一定要有get和set方法
		// 这里 getter 是存放获取computed值的方法
		const getter = typeof userDef === "function" ? userDef : userDef.get;
		if (process.env.NODE_ENV !== "production" && getter == null) {
			// 如果没有则给出警告
			warn(`Getter is missing for computed property "${key}".`, vm);
		}

		if (!isSSR) {
			// 这里相当于是给每个属性添加一个依赖watcher
			watchers[key] = new Watcher(
				vm,
				getter || noop, // 获取这个computed值的方法，要点1 getter方法
				noop,
				computedWatcherOptions // 要点2，每个computed里面的属性在添加computed watcher的时候都传入了这个属性 lazy:true，这个属性是缓存的关键，决定了watcher的diry属性，具体的到Watcher构造函数里查看
			);
		}

		// 检查computed里面的属性名是否在实例身上存在
		if (!(key in vm)) {
			// 这里会将computed里面的属性挂载到实例身上，便于 this.xxx 直接使用
			defineComputed(vm, key, userDef);
		} else if (process.env.NODE_ENV !== "production") {
			// 这一堆就是重名的错误警告了，computed里面的key不能和data、prop、methods中的名字相同
			if (key in vm.$data) {
				warn(`The computed property "${key}" is already defined in data.`, vm);
			} else if (vm.$options.props && key in vm.$options.props) {
				warn(
					`The computed property "${key}" is already defined as a prop.`,
					vm
				);
			} else if (vm.$options.methods && key in vm.$options.methods) {
				warn(
					`The computed property "${key}" is already defined as a method.`,
					vm
				);
			}
		}
	}
}

export function defineComputed(
	target: any,
	key: string,
	userDef: Object | Function
) {
	// 是否需要缓存，不是服务端渲染的话就需要缓存
	const shouldCache = !isServerRendering();

	// sharedPropertyDefinition 属性修饰符
	if (typeof userDef === "function") {
		sharedPropertyDefinition.get = shouldCache
			? // 关键就是这个createComputedGetter，他创建了需要缓存的computed的get，也就是每次获取computed的值，都要经过
			  // createComputedGetter 所创建的get方法
			  createComputedGetter(key)
			: createGetterInvoker(userDef);
		sharedPropertyDefinition.set = noop;
	} else {
		sharedPropertyDefinition.get = userDef.get
			? shouldCache && userDef.cache !== false
				? createComputedGetter(key)
				: createGetterInvoker(userDef.get)
			: noop;
		sharedPropertyDefinition.set = userDef.set || noop;
	}
	if (
		process.env.NODE_ENV !== "production" &&
		sharedPropertyDefinition.set === noop
	) {
		sharedPropertyDefinition.set = function () {
			warn(
				`Computed property "${key}" was assigned to but it has no setter.`,
				this
			);
		};
	}

	// 这里其实就是重写computed里面每个属性的get方法了，并且代理到vm实例身上，便于this.xxx 直接使用computed的值
	Object.defineProperty(target, key, sharedPropertyDefinition);
}

// 给computed里面的属性创建getter的方法
function createComputedGetter(key) {
	return function computedGetter() {
		// 获取到computed中该属性的依赖 this._computedWatchers[key]
		const watcher = this._computedWatchers && this._computedWatchers[key];
		// 要知道这个watcher是必然有的
		if (watcher) {
			// 这里是要点，很明显，如果watcher.dirty 为true的时候，就会执行 watcher.evaluate 方法
			// 而watcher.evaluate 方法就是计算computed的值（可以去Watcher构造函数查看）
			// 也就是说只有watcher.dirty为true，才会执行
			// 所以能猜到了，之所以computed能具有缓存特性，关键就是这里
			// 实际上第一次获取值的时候，dirty一定为true，因为dirty一开始由lazy决定，上面说过了
			// 因此第一次一定会计算computed的值，重点是evaluate方法计算后就将dirty变为false了，然后，看下面
			if (watcher.dirty) {
				watcher.evaluate();
			}
			// 这里就是在计算了computed的值之后，重新收集依赖，因为computed可能依赖于其它的响应式变量
			// 要点来了，如果收集到了依赖，那么上面的那个watcher.dirty的值就开始由这些依赖决定了，
			// 当某个依赖更新了，执行了notify方法，进而触发了watcher的update方法，那么就会将dirty再次变为true
			// 因此这个页面渲染再次获取computed里的这个值的时候，由于dirty为true，只能重新计算
			// 反之，如果没有依赖更新，也就不会触发watcher的update方法，也就不会将dirty变为true，那么computed也就不去触发
			// evaluate方法重新计算，而是直接返回watcher上次保留的值value
			if (Dep.target) {
				watcher.depend();
			}

			// 突然又想到了这个流程
			// 由于第一次一定会进行一次计算，也就是执行 watcher.evaluate() 方法，那么如果在这个计算的过程中，这个computed变量
			// 依赖了其它的响应式变量，那么这个响应式变量也会将这个 computed watcher 当作依赖收集起来
			// 那么当这个变量改变的时候，会通知这个 computed watcher ，并且会执行update方法，以此来更新dirty为true，那么下次再次
			// 获取这个computed值的时候，就会重新计算
			return watcher.value;
		}
	};
}

// 不需要缓存的方式，那就是直接调用getter取值
function createGetterInvoker(fn) {
	return function computedGetter() {
		return fn.call(this, this);
	};
}

// 初始化 methods
function initMethods(vm: Component, methods: Object) {
	// 初始化methods的逻辑比较简单
	// 直接遍历methods，做一下类型、名字的校验，最后直接添加到实例上
	// 因此可直接 this.xxx 调用methods里面的方法
	const props = vm.$options.props;
	for (const key in methods) {
		if (process.env.NODE_ENV !== "production") {
			if (typeof methods[key] !== "function") {
				warn(
					`Method "${key}" has type "${typeof methods[
						key
					]}" in the component definition. ` +
						`Did you reference the function correctly?`,
					vm
				);
			}
			if (props && hasOwn(props, key)) {
				warn(`Method "${key}" has already been defined as a prop.`, vm);
			}
			if (key in vm && isReserved(key)) {
				warn(
					`Method "${key}" conflicts with an existing Vue instance method. ` +
						`Avoid defining component methods that start with _ or $.`
				);
			}
		}
		vm[key] =
			typeof methods[key] !== "function" ? noop : bind(methods[key], vm);
	}
}

// 初始化 watch
function initWatch(vm: Component, watch: Object) {
	// 遍历watch里面的所有属性
	for (const key in watch) {
		// 获取属性值，可能是个数组，如果是数组就遍历处理
		const handler = watch[key];
		if (Array.isArray(handler)) {
			for (let i = 0; i < handler.length; i++) {
				createWatcher(vm, key, handler[i]);
			}
		} else {
			// 类似上面computed的创建，直接进入createWatcher方法查看
			createWatcher(vm, key, handler);
		}
	}
}

// 创建watcher
function createWatcher(
	vm: Component,
	expOrFn: string | Function,
	handler: any,
	options?: Object
) {
	// 判断是否是个普通对象
	if (isPlainObject(handler)) {
		// 由于watch有两种写法，一种是直接一个函数，一种是一个对象（里面由hanlder函数、deep、immediate）
		options = handler;
		// 就是那个获取那个用户传入的 监听到值变化后要执行的方法
		handler = handler.handler;
	}
	if (typeof handler === "string") {
		handler = vm[handler];
	}
	// 进入下面 stateMixin中 $watch 方法查看
	return vm.$watch(expOrFn, handler, options);
}

export function stateMixin(Vue: Class<Component>) {
	const dataDef = {};
	dataDef.get = function () {
		return this._data;
	};
	const propsDef = {};
	propsDef.get = function () {
		return this._props;
	};
	if (process.env.NODE_ENV !== "production") {
		dataDef.set = function () {
			warn(
				"Avoid replacing instance root $data. " +
					"Use nested data properties instead.",
				this
			);
		};
		propsDef.set = function () {
			warn(`$props is readonly.`, this);
		};
	}
	Object.defineProperty(Vue.prototype, "$data", dataDef);
	Object.defineProperty(Vue.prototype, "$props", propsDef);

	Vue.prototype.$set = set;
	Vue.prototype.$delete = del;

	Vue.prototype.$watch = function (
		expOrFn: string | Function,
		cb: any,
		options?: Object
	): Function {
		const vm: Component = this;
		if (isPlainObject(cb)) {
			return createWatcher(vm, expOrFn, cb, options);
		}
		options = options || {};
		options.user = true;

		//这里就是直接创建一个Watcher，分别传入实例vm、key、回调函数也就是用户传的那个方法、其它选项
		const watcher = new Watcher(vm, expOrFn, cb, options);

		// 熟悉的immediate属性，立即执行的意思
		// 从这里可以看出，如果设置了该属性为true，那么立即会将这个回调函数
		// v2.4.2版本这一块源码是这么写的（这样这个属性的意思就更直观了）
		// if (options.immediate) {
		//   cb.call(vm, watcher.value)
		// }
		if (options.immediate) {
			const info = `callback for immediate watcher "${watcher.expression}"`;
			pushTarget();
			invokeWithErrorHandling(cb, vm, [watcher.value], vm, info);
			popTarget();
		}
		return function unwatchFn() {
			watcher.teardown();
		};
	};
}
