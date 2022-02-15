/* @flow */

import config from "core/config";
import { warn, cached } from "core/util/index";
import { mark, measure } from "core/util/perf";

import Vue from "./runtime/index";
import { query } from "./util/index";
import { compileToFunctions } from "./compiler/index";
import {
	shouldDecodeNewlines,
	shouldDecodeNewlinesForHref,
} from "./util/compat";

const idToTemplate = cached((id) => {
	const el = query(id);
	return el && el.innerHTML;
});

// 先获取的Vue.prototype.$mount 是 mountComponent 方法
const mount = Vue.prototype.$mount;

// 运行时渲染页面用的$mount方法
Vue.prototype.$mount = function (
	el?: string | Element,
	hydrating?: boolean
): Component {
	el = el && query(el);

	// el不能选择html或者body元素
	if (el === document.body || el === document.documentElement) {
		process.env.NODE_ENV !== "production" &&
			warn(
				`Do not mount Vue to <html> or <body> - mount to normal elements instead.`
			);
		return this;
	}

	// 合并后的用户选项
	const options = this.$options;
	if (!options.render) {
		let template = options.template;
		if (template) {
			// template有3种写法
			// 1. template: "<div>{{name}}</div>"
			// 2. template: "#demo1"
			// 3. <script type="x-template" id="demo2"></script> ==> template: "#demo2"

			// 因此以下这些判断最终就是为了得到 要编译模板字符串
			if (typeof template === "string") {
				if (template.charAt(0) === "#") {
					template = idToTemplate(template);
					if (process.env.NODE_ENV !== "production" && !template) {
						warn(
							`Template element not found or is empty: ${options.template}`,
							this
						);
					}
				}
			} else if (template.nodeType) {
				template = template.innerHTML;
			} else {
				if (process.env.NODE_ENV !== "production") {
					warn("invalid template option:" + template, this);
				}
				return this;
			}
		} else if (el) {
			template = getOuterHTML(el);
		}

		// 到这里就是获取到template了
		if (template) {
			if (process.env.NODE_ENV !== "production" && config.performance && mark) {
				mark("compile");
			}

			// 要点 将模板字符串编译(compile)成render函数, 并且赋值给options.render
			// 最终返回以下三个属性
			// ast,
			// render: code.render,
			// staticRenderFns: code.staticRenderFns
			const { render, staticRenderFns } = compileToFunctions(
				template,
				{
					outputSourceRange: process.env.NODE_ENV !== "production",
					shouldDecodeNewlines,
					shouldDecodeNewlinesForHref,
					delimiters: options.delimiters,
					comments: options.comments,
				},
				this
			);

			// 赋值给options
			options.render = render;
			options.staticRenderFns = staticRenderFns;

			if (process.env.NODE_ENV !== "production" && config.performance && mark) {
				mark("compile end");
				measure(`vue ${this._name} compile`, "compile", "compile end");
			}
		}
	}

	// 转换render函数完成后，开始挂载
	return mount.call(this, el, hydrating);
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
	if (el.outerHTML) {
		return el.outerHTML;
	} else {
		const container = document.createElement("div");
		container.appendChild(el.cloneNode(true));
		return container.innerHTML;
	}
}

Vue.compile = compileToFunctions;

export default Vue;
