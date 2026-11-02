const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { load, createHooks, treeNodes, plain, esm, native, theme } = require('./helpers/react-ui.cjs');
const Jimp = createRequire(require.resolve('@expo/image-utils'))('jimp-compact');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const catalog = 'ios/Expenzo/Images.xcassets';
const asset = 'canonical-website-logo';
const BrandLogo = load('components/BrandLogo.js', {
  react: {}, 'react-native': native, '../assets/logo.png': asset,
}).default;

test('app logo preserves its image, square sizing and colours for accessibility', () => {
  for (const size of [44, 48, 74]) {
    const image = BrandLogo({ size });
    assert.equal(image.type, 'Image');
    assert.equal(image.props.source, asset);
    assert.deepEqual(plain(image.props.style), { width: size, height: size });
    assert.equal(image.props.resizeMode, 'contain');
    assert.equal(image.props.accessibilityRole, 'image');
    assert.equal(image.props.accessibilityLabel, 'Expenzo logo');
    assert.equal(image.props.accessibilityIgnoresInvertColors, true);
  }
});

test('all generated app/native PNGs retain the website mark and original fill colours', async () => {
  const svg = read('website/assets/expenzo-mark.svg').toString();
  const fills = [...svg.matchAll(/<path[^>]*fill="(#[\da-f]{6})"/gi)].map(match => match[1]);
  assert.deepEqual(fills, ['#3157ff', '#10121d']);
  const outputs = [
    ['assets/logo.png', 1024, 1024], ['assets/icon.png', 1024, 704, true],
    ['assets/adaptive-icon.png', 1024, 480], ['assets/favicon.png', 64, 56, true],
    [`${catalog}/AppIcon.appiconset/App-Icon-1024x1024@1x.png`, 1024, 704, true],
    ...[1, 2, 3].map(scale => [
      `${catalog}/SplashScreenLogo.imageset/image${scale === 1 ? '' : `@${scale}x`}.png`, 160 * scale, 160 * scale,
    ]),
  ];
  for (const [file, size, mark, opaque] of outputs) {
    const image = await Jimp.read(read(file));
    assert.equal(image.bitmap.width, size, file);
    assert.equal(image.bitmap.height, size, file);
    const padding = (size - mark) / 2;
    const sample = (x, y) => image.getPixelColor(Math.floor(padding + mark * x / 48), Math.floor(padding + mark * y / 48));
    for (const [x, y, colour] of [[24, 9, fills[0]], [18, 24, fills[0]], [17, 39, fills[0]], [41, 39, fills[1]]]) {
      assert.equal(sample(x, y), parseInt(`${colour.slice(1)}ff`, 16), `${file} at ${x},${y}`);
    }
    for (const [x, y] of [[24, 2], [40, 24]]) {
      if (opaque) assert.equal(sample(x, y), 0xf3f5ffff, file);
      else assert.equal(Jimp.intToRGBA(sample(x, y)).a, 0, file);
    }
  }
  assert.deepEqual(read(`${catalog}/AppIcon.appiconset/App-Icon-1024x1024@1x.png`), read('assets/icon.png'));
});

test('Android adaptive artwork stays inside the circular launcher safe zone', async () => {
  const image = await Jimp.read(read('assets/adaptive-icon.png'));
  const { width, height, data } = image.bitmap;
  const radiusSquared = (width * 33 / 108) ** 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!data[(y * width + x) * 4 + 3]) continue;
    assert.ok((x + 0.5 - width / 2) ** 2 + (y + 0.5 - height / 2) ** 2 <= radiusSquared, `clipped pixel ${x},${y}`);
  }
});

test('splash, welcome and personal/company auth headers show one shared logo on light/dark themes', () => {
  const animation = () => ({ start() {}, stop() {} });
  const Animated = { View: 'AnimatedView', Value: class { interpolate({ outputRange }) { return outputRange[0]; } },
    spring: animation, timing: animation, sequence: animation, loop: animation };
  const environment = { ...native, Animated, Easing: { out: value => value, inOut: value => value } };
  const flatten = style => Object.assign({}, ...(Array.isArray(style) ? style : [style]));
  for (const currentTheme of [theme, { ...theme, isDarkMode: true }]) {
    for (const file of ['screens/personal/SplashScreen.js', 'screens/personal/UserTypeScreen.js', 'components/account/AccountPrimitives.js']) {
      const hooks = createHooks();
      const useTheme = () => ({ theme: currentTheme, isLoading: false });
      const primitives = load('components/account/AccountPrimitives.js', {
        react: hooks.react, 'react-native': environment,
        'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
        'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme },
        '../../constants/Icons': { Icon: 'Icon' }, '../../utils/profileImage': {},
        '../GlassCard': esm('GlassCard'), '../BrandLogo': esm(BrandLogo),
      });
      const Screen = file.includes('AccountPrimitives') ? primitives.AccountScreen : load(file, {
        react: hooks.react, 'react-native': environment,
        'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 34 }) },
        'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme },
        '../../components/BrandLogo': esm(BrandLogo), '../../components/account/AccountPrimitives': primitives,
        'expo-splash-screen': { hideAsync: async () => {} }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
        './SplashScreen': esm('SplashScreen'),
      }).default;
      const routes = [];
      for (const title of ['Expenzo', 'Expenzo Business']) {
        const tree = hooks.render(() => Screen({ title, brand: true, navigation: { navigate: route => routes.push(route) } }));
        const images = treeNodes(tree).filter(node => node.type === 'Image');
        assert.equal(images.length, 1, file);
        assert.equal(images[0].props.source, asset, file);
        const badge = treeNodes(tree, false).find(node => node.props.children?.type === BrandLogo);
        assert.equal(flatten(badge.props.style).backgroundColor, '#f3f5ff', file);
        if (file.includes('UserType')) {
          for (const label of ['Personal account', 'Company account']) {
            treeNodes(tree).find(node => node.props.accessibilityLabel === label).props.onPress();
          }
        }
      }
      if (file.includes('UserType')) assert.deepEqual(routes, ['Login', 'CompanyLogin', 'Login', 'CompanyLogin']);
      hooks.unmount();
    }
  }
});

test('Expo and the maintained iOS launch screen point at the matching logo assets', () => {
  const { expo } = JSON.parse(read('app.json'));
  assert.equal(expo.icon, './assets/icon.png');
  assert.equal(expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
  assert.equal(expo.android.adaptiveIcon.backgroundColor, '#f3f5ff');
  assert.equal(expo.web.favicon, './assets/favicon.png');
  const splash = expo.plugins.find(plugin => plugin[0] === 'expo-splash-screen')[1];
  assert.equal(splash.image, './assets/logo.png');
  assert.equal(splash.backgroundColor, '#f3f5ff');
  assert.equal(splash.imageWidth, 160);
  const colours = JSON.parse(read(`${catalog}/SplashScreenBackground.colorset/Contents.json`)).colors[0].color.components;
  const rgb = ['red', 'green', 'blue'].map(channel => Math.round(Number(colours[channel]) * 255));
  assert.deepEqual(rgb, [243, 245, 255]);
  const storyboard = read('ios/Expenzo/SplashScreen.storyboard').toString();
  for (const attribute of ['centerX', 'centerY']) assert.match(storyboard, new RegExp(`firstAttribute="${attribute}"`));
  for (const attribute of ['width', 'height']) assert.match(storyboard, new RegExp(`firstAttribute="${attribute}" constant="160"`));
});
