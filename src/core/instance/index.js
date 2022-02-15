import { initMixin } from "./init";
import { stateMixin } from "./state";
import { renderMixin } from "./render";
import { eventsMixin } from "./events";
import { lifecycleMixin } from "./lifecycle";
import { warn } from "../util/index";

// Vue的构造函数
function Vue(options) {
	// 这里判断Vue的调用方式 必须使用new关键字 也就是 new Vue()
	if (process.env.NODE_ENV !== "production" && !(this instanceof Vue)) {
		warn("Vue is a constructor and should be called with the `new` keyword");
	}
	// 可称之为生命的起源方法 _init，这个方法的定义来自下面的 initMixin
	this._init(options);
}

// 添加了 _init 方法
initMixin(Vue);

// 原型上添加 $data、$props、$set、$delete、$watch
stateMixin(Vue);

// 原型上添加与事件相关的方法，$on、$once、$off等
eventsMixin(Vue);

// 原型上添加生命周期相关方法，_update、$forceUpdate、$destroy等
lifecycleMixin(Vue);

// 添加render相关方法，如_render, $nextTick等
renderMixin(Vue);

export default Vue;
