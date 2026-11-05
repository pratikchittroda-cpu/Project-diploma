const test = require('node:test');
const assert = require('node:assert/strict');
const { load, native, treeNodes, treeText } = require('./helpers/react-ui.cjs');

const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};

test('AI Markdown text renders emphasis and lists without showing syntax markers', () => {
  const MarkdownText = load('components/MarkdownText.js', { react: {}, 'react-native': native }).default;
  const tree = MarkdownText({ children: '# Plan\nSave **more** and _review_ `food`.\n\n- Groceries\n- Transport' });
  const text = treeText(tree);
  assert.ok(text.includes('Plan'));
  assert.ok(text.includes('Save more and review food.'));
  assert.ok(text.includes('Groceries'));
  assert.ok(!text.includes('**') && !text.includes('_review_') && !text.includes('`food`'));

  const bold = treeNodes(tree).find(node => node.type === 'Text' && treeText(node) === 'more');
  assert.equal(flatten(bold.props.style).fontWeight, '800');
  const italic = treeNodes(tree).find(node => node.type === 'Text' && treeText(node) === 'review');
  assert.equal(flatten(italic.props.style).fontStyle, 'italic');
});
