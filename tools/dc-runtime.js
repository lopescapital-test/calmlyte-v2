/* Calmlyte static runtime.
 *
 * Replaces the Claude Design `support.js` editor runtime (React 18 + the
 * DCLogic component model) for the deployed build. It implements only the
 * four template features the approved artboards actually use — {{ }}
 * bindings, <sc-for>, <sc-if>, and event/ref attributes — so the approved
 * page logic can run verbatim, unedited, against real DOM.
 *
 * Rendering patches the existing tree in place rather than replacing it, so
 * element identity survives a re-render. The Spectrum page's slider depends
 * on that: it calls setPointerCapture, and a capturing element that gets
 * swapped out mid-drag loses the pointer.
 */
(function (global) {
  'use strict';

  /* The approved Spectrum logic calls React.createRef() for its slider track.
     That is the only React API any artboard touches. */
  var React = { createRef: function () { return { current: null }; } };

  var BIND = /\{\{([\s\S]+?)\}\}/g;

  function hasBinding(s) { return s.indexOf('{{') !== -1; }

  /* "a.b.c" against a scope whose prototype chain carries sc-for locals. */
  function resolve(scope, path) {
    var parts = String(path).trim().split('.');
    var v = scope[parts[0]];
    for (var i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  }

  /* split() with a capture group yields [static, path, static, path, ...] */
  function split(raw) { return raw.split(BIND); }

  function evaluate(parts, scope) {
    /* A value that is nothing but one binding passes through with its type
       intact — objects and functions must not be stringified. */
    if (parts.length === 3 && parts[0] === '' && parts[2] === '') {
      return resolve(scope, parts[1]);
    }
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i & 1) { var v = resolve(scope, parts[i]); out += (v == null ? '' : v); }
      else out += parts[i];
    }
    return out;
  }

  /* ---------- compile: template DOM -> specs, once at boot ---------- */

  function compileKids(el) {
    var out = [], kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var s = compile(kids[i]);
      if (s) out.push(s);
    }
    return out;
  }

  function compile(node) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      return { k: 't', p: hasBinding(t) ? split(t) : null, s: t };
    }
    if (node.nodeType === 8) return { k: 'c', s: node.nodeValue };
    if (node.nodeType !== 1) return null;

    /* localName, not tagName: for HTML it is already lowercase, and for SVG it
       preserves the authored casing. Both matter — createElementNS is
       case-sensitive in every namespace, so 'IMG' in the XHTML namespace makes
       an unknown element, and 'lineargradient' in the SVG namespace makes a
       gradient that never paints. */
    var tag = node.localName;
    if (tag === 'sc-for') {
      return { k: 'for', list: node.getAttribute('data-list'),
               as: node.getAttribute('data-as'), ch: compileKids(node) };
    }
    if (tag === 'sc-if') {
      return { k: 'if', val: node.getAttribute('data-val'), ch: compileKids(node) };
    }

    var attrs = [], events = [], ref = null;
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i], n = a.name, v = a.value;
      if (n === 'data-on') {
        v.split(';').forEach(function (pair) {
          var ix = pair.indexOf(':');
          if (ix > 0) events.push({ type: pair.slice(0, ix), path: pair.slice(ix + 1) });
        });
        continue;
      }
      if (n === 'data-ref') { ref = v; continue; }
      attrs.push({ n: n, p: hasBinding(v) ? split(v) : null, s: v });
    }

    return { k: 'e', tag: tag, ns: node.namespaceURI,
             attrs: attrs, events: events, ref: ref, ch: compileKids(node) };
  }

  /* ---------- render: specs + scope -> flat child list ---------- */

  function flatten(specs, scope, out) {
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      if (s.k === 'for') {
        var list = resolve(scope, s.list);
        if (Array.isArray(list)) {
          for (var j = 0; j < list.length; j++) {
            var inner = Object.create(scope);
            inner[s.as] = list[j];
            flatten(s.ch, inner, out);
          }
        }
      } else if (s.k === 'if') {
        if (resolve(scope, s.val)) flatten(s.ch, scope, out);
      } else {
        out.push({ spec: s, scope: scope });
      }
    }
    return out;
  }

  function reusable(node, spec) {
    if (!node) return false;
    if (spec.k === 't') return node.nodeType === 3;
    if (spec.k === 'c') return node.nodeType === 8;
    return node.nodeType === 1 && node.localName === spec.tag;
  }

  function create(spec) {
    if (spec.k === 't') return document.createTextNode(spec.s);
    if (spec.k === 'c') return document.createComment(spec.s);
    return spec.ns
      ? document.createElementNS(spec.ns, spec.tag)
      : document.createElement(spec.tag);
  }

  function apply(node, spec, scope) {
    if (spec.k === 't') {
      var raw = spec.p ? evaluate(spec.p, scope) : spec.s;
      var txt = (raw == null) ? '' : String(raw);
      if (node.nodeValue !== txt) node.nodeValue = txt;
      return;
    }
    if (spec.k === 'c') return;

    for (var i = 0; i < spec.attrs.length; i++) {
      var a = spec.attrs[i];
      if (!a.p) {
        if (node.getAttribute(a.n) !== a.s) node.setAttribute(a.n, a.s);
        continue;
      }
      var v = evaluate(a.p, scope);
      if (v == null || v === false) node.removeAttribute(a.n);
      else if (node.getAttribute(a.n) !== String(v)) node.setAttribute(a.n, String(v));
    }

    /* Handlers are attached once and look the current value up at dispatch
       time, so a re-render never detaches a live listener. */
    node.__scope = scope;
    if (spec.events.length && !node.__wired) {
      node.__wired = true;
      spec.events.forEach(function (ev) {
        node.addEventListener(ev.type, function (e) {
          var fn = resolve(node.__scope, ev.path);
          if (typeof fn === 'function') fn(e);
        });
      });
    }

    if (spec.ref) {
      var box = resolve(scope, spec.ref);
      if (box && typeof box === 'object') box.current = node;
    }

    patch(node, spec.ch, scope);
  }

  function patch(parent, specs, scope) {
    var want = flatten(specs, scope, []);
    var kids = parent.childNodes;
    for (var i = 0; i < want.length; i++) {
      var w = want[i], node = kids[i];
      if (!reusable(node, w.spec)) {
        var fresh = create(w.spec);
        if (node) parent.replaceChild(fresh, node);
        else parent.appendChild(fresh);
        node = fresh;
      }
      apply(node, w.spec, w.scope);
    }
    while (kids.length > want.length) parent.removeChild(kids[kids.length - 1]);
  }

  /* ---------- component model ---------- */

  function DCLogic() {}
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.setState = function (patchOrFn) {
    var next = (typeof patchOrFn === 'function') ? patchOrFn(this.state) : patchOrFn;
    for (var k in next) {
      if (Object.prototype.hasOwnProperty.call(next, k)) this.state[k] = next[k];
    }
    if (this.__mounted) this.__render();
  };

  function page(config) {
    var tpl = document.getElementById('dc-template');
    var root = document.getElementById('dc-root');
    if (!tpl || !root) return;

    var specs = compileKids(tpl.content);
    var Component = config.logic(DCLogic, React);
    var instance = new Component();

    instance.props = config.props || {};
    if (!instance.state) instance.state = {};
    instance.__render = function () { patch(root, specs, instance.renderVals()); };
    instance.__mounted = true;
    instance.__render();

    if (typeof instance.componentDidMount === 'function') instance.componentDidMount();
    window.addEventListener('pagehide', function () {
      if (typeof instance.componentWillUnmount === 'function') instance.componentWillUnmount();
    });

    global.__calmlyte = instance;
  }

  global.DC = { page: page };
})(window);
