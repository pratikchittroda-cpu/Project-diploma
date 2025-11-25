import { HUGGINGFACE_API_KEY } from '@env';

// AI Configuration for Hugging Face API
export const AI_CONFIG = {
    // Hugging Face API
    API_KEY: HUGGINGFACE_API_KEY,
    API_ENDPOINT: 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',

    // Categories for classification
    CATEGORIES: [
        'food and dining',
        'transportation and travel',
        'shopping and retail',
        'entertainment and leisure',
        'bills and utilities',
        'health and medical',
        'other expenses'
    ],

    // Category mapping to app categories
    CATEGORY_MAP: {
        'food and dining': 'food',
        'transportation and travel': 'transport',
        'shopping and retail': 'shopping',
        'entertainment and leisure': 'entertainment',
        'bills and utilities': 'bills',
        'health and medical': 'health',
        'other expenses': 'other'
    },

    // Non-essential items for budget recommendations
    NON_ESSENTIAL_KEYWORDS: {
        coffee: ['coffee', 'cafe', 'starbucks', 'cafe coffee day', 'barista', 'cappuccino', 'latte', 'espresso'],
        coldDrinks: ['coke', 'pepsi', 'soda', 'cold drink', 'soft drink', 'juice', 'smoothie'],
        snacks: ['chips', 'snacks', 'chocolate', 'candy', 'biscuit', 'cookies'],
        diningOut: ['restaurant', 'dining', 'food delivery', 'zomato', 'swiggy', 'uber eats', 'pizza', 'burger'],
        entertainment: ['movie', 'cinema', 'pvr', 'inox', 'netflix', 'spotify', 'game', 'concert']
    },

    // Budget thresholds for alerts
    BUDGET_THRESHOLDS: {
        WARNING: 0.70,    // 70% - Show warning
        CRITICAL: 0.90,   // 90% - Show critical alert
        EXCEEDED: 1.0     // 100% - Budget exceeded
    },

    // Recommendation settings
    RECOMMENDATIONS: {
        MIN_SAVINGS_AMOUNT: 100,  // Minimum amount to suggest savings (₹100)
        LOOKBACK_DAYS: 30,        // Analyze last 30 days
        MAX_SUGGESTIONS: 3        // Show max 3 suggestions at a time
    }
};
