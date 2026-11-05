const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, native, treeNodes, treeText } = require('./helpers/react-ui.cjs');

const root = path.resolve(__dirname, '..');
const fontFiles = Object.fromEntries(['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'].flatMap(weight => [
  [`@expo-google-fonts/manrope/${weight}`, { [`Manrope_${weight}`]: `manrope-${weight}.ttf` }],
  [`@expo-google-fonts/syne/${weight}`, { [`Syne_${weight}`]: `syne-${weight}.ttf` }],
]));

function loadTypography({ fontsLoaded = true } = {}) {
  const react = { useState: value => [value, () => {}], useEffect() {} };
  const fonts = load('theme/fonts.js', { react, 'expo-font': { useFonts: () => [fontsLoaded, null] }, ...fontFiles });
  fonts.useAppFonts();
  // Minimal context: each Provider passes its value to the elements rendered inside it.
  let current = null;
  const Context = { Provider: 'FontProvider' };
  const typography = load('theme/typography/index.js', {
    react: { createContext: () => Context, forwardRef: render => props => render(props, null), useContext: () => current },
    'react-native': { ...native, Text: 'NativeText', TextInput: 'NativeTextInput', StyleSheet: { flatten: style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) } },
    '../fonts': fonts,
  });
  // Renders one Text call with `parent` as the surrounding font context.
  const render = (call, parent = null) => {
    current = parent;
    const provider = call();
    return { provider, node: provider.props.children, font: provider.props.value };
  };
  return { fonts, typography, render };
}
const family = node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)).fontFamily;

test('brand fonts map each weight to its own face, with Syne for display sizes', () => {
  const { fonts } = loadTypography();
  assert.deepEqual(Object.keys(fonts.APP_FONTS).sort(), ['Manrope_400Regular', 'Manrope_500Medium', 'Manrope_600SemiBold', 'Manrope_700Bold', 'Manrope_800ExtraBold',
    'Syne_400Regular', 'Syne_500Medium', 'Syne_600SemiBold', 'Syne_700Bold', 'Syne_800ExtraBold']);
  assert.equal(fonts.brandFontFamily({}), 'Manrope_400Regular');
  assert.equal(fonts.brandFontFamily({ fontSize: 14, fontWeight: '600' }), 'Manrope_600SemiBold');
  assert.equal(fonts.brandFontFamily({ fontSize: 16, fontWeight: 'bold' }), 'Manrope_700Bold');
  assert.equal(fonts.brandFontFamily({ fontSize: 23, fontWeight: '900' }), 'Manrope_800ExtraBold');
  assert.equal(fonts.brandFontFamily({ fontSize: 24, fontWeight: '700' }), 'Syne_700Bold');
  assert.equal(fonts.brandFontFamily({ fontSize: 48, fontWeight: '300' }), 'Syne_400Regular');
});

test('Text applies the brand face, keeps explicit families, and nested text inherits', () => {
  const { typography: { Text }, render } = loadTypography();
  const title = render(() => Text({ style: [{ fontSize: 32 }, { fontWeight: '800' }], children: 'Welcome back' }));
  assert.equal(title.node.type, 'NativeText');
  assert.equal(family(title.node), 'Syne_800ExtraBold');
  assert.equal(Object.assign({}, ...title.node.props.style.flat()).fontWeight, 'normal');
  assert.equal(family(render(() => Text({ style: { fontWeight: '600' }, children: 'Save' })).node), 'Manrope_600SemiBold');
  assert.equal(family(render(() => Text({ style: { fontFamily: 'monospace' }, children: 'code' })).node), 'monospace');
  // A colour-only child keeps its parent's face; a child that changes weight gets its own.
  const parent = render(() => Text({ style: { fontSize: 16, fontWeight: '700' }, children: 'Total' })).font;
  assert.equal(family(render(() => Text({ style: { color: 'red' }, children: 'due' }), parent).node), undefined);
  assert.equal(family(render(() => Text({ style: { fontWeight: '400' }, children: 'note' }), parent).node), 'Manrope_400Regular');
  const code = render(() => Text({ style: { fontFamily: 'monospace' }, children: 'a' })).font;
  assert.equal(family(render(() => Text({ style: { fontWeight: '700' }, children: 'b' }), code).node), undefined);
});

test('every letter x is drawn in the logo blue without changing the text', () => {
  const { typography: { Text, TextInput, accentX }, render } = loadTypography();
  const { node } = render(() => Text({ children: ['Expenses ', 12, ' Tax EXPORT'] }));
  assert.equal(treeText(node), 'Expenses 12 Tax EXPORT');
  const accents = treeNodes(node).filter(child => child !== node && child.type === 'NativeText');
  assert.deepEqual(accents.map(child => child.props.children), ['x', 'x', 'X']);
  for (const child of accents) assert.equal(child.props.style.color, '#3157FF');
  assert.equal(accentX('Budget'), 'Budget');
  assert.equal(accentX(null), null);
  const input = TextInput({ style: { fontSize: 16, fontWeight: '500' }, value: 'x' });
  assert.equal(input.type, 'NativeTextInput');
  assert.equal(family(input), 'Manrope_500Medium');
});

test('text keeps the system face if the brand fonts never load', () => {
  const { typography: { Text }, render } = loadTypography({ fontsLoaded: false });
  assert.equal(family(render(() => Text({ style: { fontWeight: '700' }, children: 'Hi' })).node), undefined);
});

test('Metro routes only app code react-native imports through the typography shim', () => {
  const config = require(path.join(root, 'metro.config.js'));
  const resolve = (origin, name = 'react-native') => config.resolver.resolveRequest(
    { originModulePath: path.join(root, origin), resolveRequest: () => 'upstream' }, name, 'ios');
  const shim = { type: 'sourceFile', filePath: path.join(root, 'theme/typography/react-native.js') };
  assert.deepEqual(resolve('screens/personal/HomeScreen.js'), shim);
  assert.deepEqual(resolve('App.js'), shim);
  for (const origin of ['theme/typography/react-native.js', 'theme/typography/index.js', 'node_modules/expo-font/build/index.js']) assert.equal(resolve(origin), 'upstream');
  assert.equal(resolve('App.js', 'react'), 'upstream');
  assert.deepEqual(resolve('theme/fonts.js'), shim);
});

test('the shim swaps only Text/TextInput and reads other react-native exports lazily', () => {
  const touched = [];
  const reactNative = new Proxy({}, { get: (_, name) => { touched.push(name); return `RN.${String(name)}`; }, has: () => true });
  const shim = load('theme/typography/react-native.js', { 'react-native': reactNative, './index': { Text: 'BrandText', TextInput: 'BrandInput' } }, { Proxy });
  assert.equal(shim.Text, 'BrandText');
  assert.equal(shim.TextInput, 'BrandInput');
  const keys = [];
  for (const key in shim) keys.push(key);
  assert.deepEqual(keys, ['Text', 'TextInput']);
  assert.deepEqual(touched, []);
  assert.equal(shim.View, 'RN.View');
  assert.deepEqual(touched, ['View']);
  assert.ok('Animated' in shim);
});

test('numbers stay in Manrope at every size; only wordy display text uses Syne', () => {
  const { fonts, typography: { Text, TextInput }, render } = loadTypography();
  assert.equal(fonts.brandFontFamily({ fontSize: 40, fontWeight: '800', numeric: true }), 'Manrope_800ExtraBold');
  for (const amount of ['-₹1,655.00', ['₹', 2845, '.00'], '5.2%', 'Remaining: ₹2,845.00']) {
    assert.equal(family(render(() => Text({ style: { fontSize: 40, fontWeight: '800' }, children: amount })).node), 'Manrope_800ExtraBold', String(amount));
  }
  assert.equal(family(render(() => Text({ style: { fontSize: 32, fontWeight: '800' }, children: 'Welcome back' })).node), 'Syne_800ExtraBold');
  // Numeric inputs (the amount field) use Manrope too.
  assert.equal(family(TextInput({ style: { fontSize: 32, fontWeight: '700' }, placeholder: '0.00' })), 'Manrope_700Bold');
  assert.equal(family(TextInput({ style: { fontSize: 32, fontWeight: '700' }, keyboardType: 'decimal-pad' })), 'Manrope_700Bold');
  assert.equal(family(TextInput({ style: { fontSize: 32, fontWeight: '700' }, placeholder: 'Name' })), 'Syne_700Bold');
});

test('the x accent stays readable: logo blue in dark text, light blue in white text on coloured pages', () => {
  const { typography: { Text, isLightColor }, render } = loadTypography();
  const accents = node => treeNodes(node).filter(child => child !== node && child.type === 'NativeText').map(child => child.props.style.color);
  assert.deepEqual(accents(render(() => Text({ style: { color: '#171717' }, children: 'Expenses' })).node), ['#3157FF']);
  assert.deepEqual(accents(render(() => Text({ style: { color: '#FFFFFF' }, children: 'Expenzo' })).node), ['#AFC2FF']);
  assert.deepEqual(accents(render(() => Text({ style: { color: 'rgba(255,255,255,0.82)' }, children: 'max' })).node), ['#AFC2FF']);
  // Nested text inherits the parent's colour when deciding.
  const parent = render(() => Text({ style: { color: 'white' }, children: 'Total' })).font;
  assert.deepEqual(accents(render(() => Text({ style: { fontWeight: '700' }, children: 'tax' }), parent).node), ['#AFC2FF']);
  for (const [color, light] of [['#fff', true], ['#3157FF', false], ['#0F0F0F', false], [undefined, false], ['white', true]]) assert.equal(isLightColor(color), light, String(color));
});
