const fs = require('node:fs');
const path = require('node:path');
const { ESLint } = require('eslint');
const hooks = require('eslint-plugin-react-hooks');
const globals = require('globals');
const parser = require('@babel/parser');
const { builtinModules } = require('node:module');
const { PUBLIC_ENV_NAMES } = require('./public-env.cjs');

const root = path.resolve(__dirname, '..');
const directories = ['components', 'config', 'constants', 'contexts', 'hooks', 'navigation', 'screens', 'services', 'theme', 'utils', 'scripts', 'tests', 'ai-host/src'];
const files = [];
function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(js|cjs|mjs)$/.test(file)) files.push(file);
  }
}
for (const directory of directories) collect(path.join(root, directory));
for (const name of fs.readdirSync(root)) if (/\.js$/.test(name)) files.push(path.join(root, name));

const jsxBindings = {
  meta: { schema: [] },
  create(context) {
    return { JSXOpeningElement(node) {
      let name = node.name;
      while (name.type === 'JSXMemberExpression') name = name.object;
      if (name.type !== 'JSXIdentifier' || /^[a-z]/.test(name.name)) return;
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        if (scope.set.has(name.name)) return;
        scope = scope.upper;
      }
      context.report({ node: name, message: `JSX component '${name.name}' is not defined.` });
    } };
  },
};

async function main() {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
    },
    plugins: { 'react-hooks': hooks, local: { rules: { 'jsx-bindings': jsxBindings } } },
    rules: { 'no-undef': 'error', 'react-hooks/rules-of-hooks': 'error', 'local/jsx-bindings': 'error' },
  }] });
  const results = await eslint.lintFiles(files);
  const formatted = await (await eslint.loadFormatter('stylish')).format(results);
  if (formatted) console.log(formatted);
  let errors = results.reduce((sum, result) => sum + result.errorCount, 0);
  const pkg = require('../package.json');
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const hostPackage = require('../ai-host/package.json');
  const hostDependencies = { ...hostPackage.dependencies, ...hostPackage.devDependencies };
  function checkImport(source, node, file) {
    if (source === '@env') {
      for (const specifier of node.specifiers || []) {
        if (!PUBLIC_ENV_NAMES.includes(specifier.imported?.name)) throw new Error('Non-public @env import');
      }
    } else if (source.startsWith('.')) {
      const base = path.resolve(path.dirname(file), source);
      if (!['', '.js', '.cjs', '.json', '/index.js'].some(suffix => fs.existsSync(base + suffix))) throw new Error(`Unresolved import: ${source}`);
    } else {
      const name = source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0];
      // Expo Metro explicitly aliases this historical icon import.
      if (name === 'react-native-vector-icons' || source.startsWith('node:') || builtinModules.includes(source)) return;
      const declared = file.startsWith(path.join(root, 'ai-host') + path.sep) ? hostDependencies : dependencies;
      if (!declared[name]) throw new Error(`Undeclared direct import: ${name}`);
    }
  }
  for (const file of files) {
    try {
      const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx'] });
      for (const node of ast.program.body) if (node.source) checkImport(node.source.value, node, file);
    } catch (error) {
      errors++;
      console.error(`${path.relative(root, file)}: ${error.message}`);
    }
  }
  console.log(`Checked ${files.length} source/test files; ${errors} error(s).`);
  process.exitCode = errors ? 1 : 0;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
