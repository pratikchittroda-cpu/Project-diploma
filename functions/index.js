const express = require('express');
const cors = require('cors');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const nvidiaApiKey = defineSecret('NVIDIA_API_KEY');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-12);
}

async function callNvidiaChat({ apiKey, messages, temperature = 0.4, maxTokens = 1200 }) {
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

function buildFinanceSystemPrompt() {
  return [
    'You are Expenzo Financial AI.',
    'Answer only finance-related questions.',
    'Use only the supplied user finance context.',
    'If the user asks about non-financial topics, refuse briefly and redirect to finance.',
    'Do not invent transactions or balances that are not in the provided context.',
    'Keep answers practical, concise, and specific.',
    'If useful, provide bullet-point actions.',
  ].join(' ');
}

app.post('/financial-chat', async (req, res) => {
  try {
    const apiKey = nvidiaApiKey.value();
    const { question, conversationHistory = [], financeContext } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing NVIDIA_API_KEY secret.' });
    }

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required.' });
    }

    if (!financeContext || typeof financeContext !== 'object') {
      return res.status(400).json({ error: 'Finance context is required.' });
    }

    const messages = [
      { role: 'system', content: buildFinanceSystemPrompt() },
      {
        role: 'system',
        content: `Finance context for the current signed-in user:\n${JSON.stringify(financeContext, null, 2)}`,
      },
      ...normalizeMessages(conversationHistory),
      { role: 'user', content: question.trim() },
    ];

    const answer = await callNvidiaChat({
      apiKey,
      messages,
      temperature: 0.35,
      maxTokens: 1400,
    });

    return res.json({ answer });
  } catch (error) {
    console.error('financial-chat error', error);
    return res.status(500).json({ error: 'Failed to generate financial advice.' });
  }
});

app.post('/categorize', async (req, res) => {
  try {
    const apiKey = nvidiaApiKey.value();
    const { description, candidateLabels = [], categoryMap = {} } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing NVIDIA_API_KEY secret.' });
    }

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const messages = [
      {
        role: 'system',
        content: 'Classify the expense description into exactly one category from the provided list. Return only JSON with keys label and confidence.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          description,
          candidateLabels,
        }),
      },
    ];

    const answer = await callNvidiaChat({
      apiKey,
      messages,
      temperature: 0,
      maxTokens: 150,
    });

    let parsed;
    try {
      parsed = JSON.parse(answer);
    } catch (error) {
      parsed = { label: candidateLabels[0] || 'other expenses', confidence: 0.4 };
    }

    const mappedCategory = categoryMap[parsed.label] || 'other';
    return res.json({
      category: mappedCategory,
      confidence: Number(parsed.confidence) || 0.4,
    });
  } catch (error) {
    console.error('categorize error', error);
    return res.status(500).json({ error: 'Failed to categorize transaction.' });
  }
});

app.post('/parse-receipt', async (req, res) => {
  try {
    const apiKey = nvidiaApiKey.value();
    const { receiptText } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing NVIDIA_API_KEY secret.' });
    }

    if (!receiptText || typeof receiptText !== 'string') {
      return res.status(400).json({ error: 'Receipt text is required.' });
    }

    const messages = [
      {
        role: 'system',
        content: 'Extract receipt line items. Return only JSON array items with fields name, quantity, price.',
      },
      {
        role: 'user',
        content: receiptText,
      },
    ];

    const answer = await callNvidiaChat({
      apiKey,
      messages,
      temperature: 0,
      maxTokens: 900,
    });

    try {
      const items = JSON.parse(answer);
      return res.json({ items: Array.isArray(items) ? items : [] });
    } catch (error) {
      return res.json({ items: [] });
    }
  } catch (error) {
    console.error('parse-receipt error', error);
    return res.status(500).json({ error: 'Failed to parse receipt.' });
  }
});

exports.ai = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 120,
    memory: '1GiB',
    secrets: [nvidiaApiKey],
  },
  app
);
