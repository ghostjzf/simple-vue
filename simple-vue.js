const utils = {
  getValue(expr, vm) {
    return vm.$data[expr];
  },
  setValue(expr, vm, newVal) {
    vm.$data[expr] = newVal;
  },
  model(node, expr, vm) {
    const initialValue = this.getValue(expr, vm);

    new Watcher(expr, vm, (newValue) => {
      this.modelUpdater(node, newValue);
    });

    node.addEventListener("input", (e) => {
      const newValue = e.target.value;

      this.setValue(expr, vm, newValue);
    });

    console.log(initialValue);
  },
  on(node, expr, vm, eventName) {
    const fn = vm.$options.methods[expr];

    node.addEventListener(eventName, fn.bind(vm), false);
  },
  text(node, textContent, vm) {
    let result;

    if (textContent.includes("{{")) {
      result = textContent.replace(/\{\{(.+)\}\}/, (...args) => {
        const expr = args[1].trim();

        new Watcher(expr, vm, (newVal) => {
          this.textUpdater(node, newVal);
        });

        return this.getValue(expr, vm);
      });
    } else {
      result = this.getValue(textContent, vm);
    }

    this.textUpdater(node, result);
  },
  textUpdater(node, value) {
    node.textContent = value;
  },
  modelUpdater(node, value) {
    node.value = value;
  },
};

// 搜集dom的依赖
class Watcher {
  constructor(expr, vm, cb) {
    this.expr = expr;
    this.vm = vm;
    this.cb = cb;

    this.oldValue = this.getOldValue();
  }

  getOldValue() {
    Dep.target = this;

    const oldValue = utils.getValue(this.expr, this.vm);

    Dep.target = null;

    return oldValue;
  }

  update() {
    const newValue = utils.getValue(this.expr, this.vm);
    if (newValue !== this.oldValue) {
      this.cb(newValue);
    }
  }
}

class Dep {
  constructor() {
    this.collect = [];
  }

  addWatcher(watcher) {
    this.collect.push(watcher);
  }

  notify() {
    this.collect.forEach((w) => w.update());
  }
}

class Compiler {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;

    const fragment = this.compilerFragment(this.el);

    this.compiler(fragment);

    this.el.appendChild(fragment);
  }

  compiler(fragment) {
    const childNodes = Array.from(fragment.childNodes);

    console.log(childNodes);

    childNodes.forEach((childNode) => {
      if (this.isElementNode(childNode)) {
        this.compileElement(childNode);
      } else if (this.isTextNode(childNode)) {
        this.compileText(childNode);
      }

      if (childNode.childNodes && childNode.childNodes.length) {
        this.compiler(childNode);
      }
    });
  }

  compileElement(node) {
    // v-
    const attributes = Array.from(node.attributes);

    attributes.forEach((attr) => {
      const { name, value } = attr;

      if (this.isDirector(name)) {
        const [, director] = name.split("-");
        const [compileKey, eventName] = director.split(":");

        utils[compileKey](node, value, this.vm, eventName);

        console.log(compileKey, eventName, value);
      } else if (this.isEventName(name)) {
        // @方法执行
        const [, eventName] = name.split("@");

        utils["on"](node, value, this.vm, eventName);
      }
    });
  }

  isEventName(name) {
    return name.startsWith("@");
  }

  isDirector(name) {
    return name.startsWith("v-");
  }

  compileText(node) {
    const textContent = node.textContent;
    const reg = /\{\{(.+)\}\}/;

    if (reg.test(textContent)) {
      utils.text(node, textContent, this.vm);
    }
  }

  compilerFragment(el) {
    const f = document.createDocumentFragment();

    let firstChild;

    while ((firstChild = el.firstChild)) {
      f.appendChild(el.firstChild);
    }

    return f;
  }

  isTextNode(node) {
    return node.nodeType === 3;
  }

  isElementNode(el) {
    return el.nodeType === 1;
  }
}

class Observer {
  constructor(data) {
    this.observe(data);
  }

  observe(data) {
    if (data && typeof data === "object") {
      Object.keys(data).forEach((key) => {
        this.defineReactive(data, key, data[key]);
      });
    }
  }

  defineReactive(obj, key, value) {
    this.observe(value);

    const dep = new Dep();
    console.log("跟新");

    Object.defineProperty(obj, key, {
      get: () => {
        const target = Dep.target;

        target && dep.addWatcher(target);

        console.log("$data getter", key);
        return value;
      },
      set: (newVal) => {
        if (newVal === value) return;

        this.observe(newVal);
        console.log("$data setter", key, newVal);
        value = newVal;

        dep.notify();
        console.log(dep);
      },
    });
  }
}

class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;

    // 触发this.xx 和模板的绑定
    new Observer(this.$data);

    // 处理模板部分，将模板中使用的 data 部分的变量和模板绑定起来
    new Compiler(this.$el, this);

    this.proxyData(this.$data);
  }

  proxyData(data) {
    Object.keys(data).forEach((key) => {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        },
      });
    });
  }
}
