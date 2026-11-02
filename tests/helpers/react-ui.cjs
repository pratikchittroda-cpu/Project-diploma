const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const jsxRuntime = require('react/jsx-runtime');
const Fragment = require('react').Fragment;
const root = path.resolve(__dirname, '../..');

function load(file, mocks = {}, globals = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL, Date, AbortController, setTimeout, clearTimeout,
    requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {},
    require: name => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name in mocks) return mocks[name];
      throw new Error(`Unmocked UI dependency ${name} in ${file}`);
    }, ...globals,
  }, { filename: file });
  return module.exports;
}

// Stateful component-level hooks; effects and cleanup are committed explicitly.
// Native rendering is mocked, not network calls or finance calculations.
function createHooks() {
  const slots = [];
  let index = 0, effects = [];
  const equal = (a, b) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (fn, deps) => {
    const slot = index++;
    if (!slots[slot] || !equal(slots[slot].deps, deps)) slots[slot] = { deps, value: fn() };
    return slots[slot].value;
  };
  const react = {
    Fragment, memo: component => component, forwardRef: render => props => render(props, props.ref),
    createContext: value => ({ value, Provider: 'TestContextProvider' }), useContext: context => context.value,
    useState(initial) {
      const slot = index++;
      if (!slots[slot]) slots[slot] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[slot].value, next => { slots[slot].value = typeof next === 'function' ? next(slots[slot].value) : next; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!slots[slot]) slots[slot] = { value: { current: initial } };
      return slots[slot].value;
    },
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const slot = index++;
      if (!slots[slot] || !equal(slots[slot].deps, deps)) {
        const old = slots[slot];
        slots[slot] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[slot].cleanup?.(); slots[slot].cleanup = fn(); });
      }
    },
    useImperativeHandle(ref, create, deps) {
      react.useEffect(() => { if (ref) ref.current = create(); return () => { if (ref) ref.current = null; }; }, deps);
    },
  };
  return { react,
    render(component) { index = 0; const tree = component(); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree; },
    unmount() { effects = []; for (const slot of slots) if (typeof slot?.cleanup === 'function') slot.cleanup(); },
  };
}

function treeNodes(node, expand = true) {
  if (Array.isArray(node)) return node.flatMap(child => treeNodes(child, expand));
  if (!node?.props) return [];
  return [node, ...treeNodes(expand && typeof node.type === 'function' ? node.type(node.props) : node.props.children, expand)];
}
function treeText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(treeText).join('');
  if (!node.props) return String(node);
  return treeText(typeof node.type === 'function' ? node.type(node.props) : node.props.children);
}
const byId = (tree, id) => treeNodes(tree).find(node => node.props.testID === id);
const button = (tree, label) => treeNodes(tree).find(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label);
const plain = value => JSON.parse(JSON.stringify(value));
const esm = value => ({ default: value, __esModule: true });
const native = Object.fromEntries(['ActivityIndicator', 'Image', 'KeyboardAvoidingView', 'Pressable', 'RefreshControl', 'ScrollView', 'StatusBar', 'Switch', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name]));
native.Platform = { OS: 'ios' };
native.StyleSheet = { create: value => value, absoluteFill: { position: 'absolute' }, absoluteFillObject: { position: 'absolute' }, hairlineWidth: 0.5 };
native.useWindowDimensions = () => ({ width: 393, height: 852, fontScale: 1 });
const theme = { primary: '#6755D7', primaryLight: '#3C74D8', text: '#171717', textSecondary: '#4A4A4A', background: '#FAFAFA', surface: '#FFFFFF', border: '#E5E7EB', warning: '#F59E0B', warningLight: '#FEF3C7', inputBackground: '#F5F5F5', primaryContainer: '#6755D720' };

module.exports = { load, createHooks, treeNodes, treeText, byId, button, plain, esm, native, theme };
