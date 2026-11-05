import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const INLINE_TOKEN = /(\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

export function parseMarkdownBlocks(value) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: heading[1] });
      continue;
    }

    const orderedItem = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const unorderedItem = trimmed.match(/^[-*•]\s+(.+)$/);
    const item = orderedItem || unorderedItem;
    if (item) {
      flushParagraph();
      const ordered = Boolean(orderedItem);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: 'list', ordered, items: [] };
      }
      list.items.push(item[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function parseInline(value) {
  const parts = [];
  let cursor = 0;
  for (const match of String(value).matchAll(INLINE_TOKEN)) {
    if (match.index > cursor) parts.push({ text: String(value).slice(cursor, match.index) });
    const token = match[0];
    const isBold = token.startsWith('**') || token.startsWith('__');
    const isCode = token.startsWith('`');
    parts.push({
      text: token.slice(isBold ? 2 : 1, isBold ? -2 : -1),
      emphasis: isBold ? 'bold' : isCode ? 'code' : 'italic',
    });
    cursor = match.index + token.length;
  }
  if (cursor < String(value).length) parts.push({ text: String(value).slice(cursor) });
  return parts.length ? parts : [{ text: String(value) }];
}

function inlineChildren(value) {
  return parseInline(value).map((part, index) => <Text key={`inline-${index}`} style={part.emphasis && styles[part.emphasis]}>{part.text}</Text>);
}

export default function MarkdownText({ children, style, selectable = true, ...props }) {
  const blocks = parseMarkdownBlocks(children);
  return <View {...props} style={styles.root}>
    {blocks.map((block, index) => {
      if (block.type === 'list') {
        return <View key={`list-${index}`} style={styles.list}>
          {block.items.map((item, itemIndex) => <View key={`item-${itemIndex}`} style={styles.listRow}>
            <Text selectable={selectable} style={[styles.bullet, style]}>{block.ordered ? `${itemIndex + 1}.` : '•'}</Text>
            <Text selectable={selectable} style={[styles.paragraph, style]}>{inlineChildren(item)}</Text>
          </View>)}
        </View>;
      }
      return <Text key={`block-${index}`} selectable={selectable}
        style={[styles.paragraph, block.type === 'heading' && styles.heading, style]}>
        {inlineChildren(block.text)}
      </Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 9 },
  paragraph: { fontSize: 15, lineHeight: 24 },
  heading: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  list: { gap: 7 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { minWidth: 18, fontSize: 15, lineHeight: 24, fontWeight: '700' },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', fontWeight: '600' },
});
