import { AI_CONFIG } from '../config/aiConfig';
import { PERSONAL_EXPENSES, COMPANY_EXPENSES, parseMoney } from '../utils/finance';
import { requestBackend } from './backendClient';

const EXPENSE_CATEGORIES = new Set([...PERSONAL_EXPENSES, ...COMPANY_EXPENSES]);
const serviceError = (code, message) => Object.assign(new Error(message), { code });
const assertNotCancelled = signal => {
    if (signal?.aborted) throw serviceError('backend/cancelled', 'Request cancelled.');
};
const errorCode = error => error?.code || (error?.name === 'AbortError' ? 'backend/cancelled' : 'backend/unavailable');

function receiptItems(result) {
    const items = Array.isArray(result) ? result : result?.items;
    const invalid = () => { throw serviceError('ai/invalid-output', 'The assistant returned invalid receipt items. Review the receipt manually.'); };
    if ((!Array.isArray(result) && (!result || typeof result !== 'object' ||
        Object.keys(result).some(key => !['items', 'requiresConfirmation'].includes(key)))) ||
        !Array.isArray(items) || !items.length || items.length > 50 ||
        (!Array.isArray(result) && result?.requiresConfirmation !== undefined && result.requiresConfirmation !== true)) invalid();
    return items.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            Object.keys(item).sort().join(',') !== 'name,price,quantity' ||
            typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 ||
            !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 ||
            typeof item.price !== 'number' || !Number.isFinite(item.price)) invalid();
        try { if (parseMoney(item.price) !== item.price) invalid(); } catch { invalid(); }
        return { name: item.name.trim(), quantity: item.quantity, price: item.price };
    });
}

const safeGet = (obj, key, defaultValue = undefined) => {
    if (!obj || typeof key !== 'string') return defaultValue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return defaultValue;
    }
    return Object.prototype.hasOwnProperty.call(obj, key) ? Reflect.get(obj, key) : defaultValue;
};

const safeSet = (obj, key, value) => {
    if (!obj || typeof key !== 'string') return false;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return false;
    }
    return Reflect.set(obj, key, value);
};

class AIService {
    normalizeFinancialAnswer(answer) {
        if (!answer || typeof answer !== 'string') {
            return 'I could not prepare a clear financial answer right now.';
        }

        let normalized = answer
            .replace(/\r/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        const lines = normalized
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        normalized = lines.join('\n');

        return normalized;
    }

    /**
     * Categorize transaction using AI
     */
    async categorizeTransaction(description, { consent = false, signal } = {}) {
        try {
            assertNotCancelled(signal);
            if (typeof description !== 'string' || description.trim().length < 2 || description.length > 500) {
                throw serviceError('request/invalid', 'Enter a description of 2–500 characters before suggesting a category.');
            }
            if (consent !== true) return this.fallbackCategorize(description);
            const result = await requestBackend('/categorize', { description: description.trim(), consent: true }, { signal });
            assertNotCancelled(signal);
            if (!result || Array.isArray(result) || Object.keys(result).sort().join(',') !== 'category,confidence' || !EXPENSE_CATEGORIES.has(result.category) ||
                typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) ||
                result.confidence < 0 || result.confidence > 1) {
                throw serviceError('ai/invalid-output', 'The assistant returned an invalid category suggestion.');
            }

            return {
                category: result.category,
                confidence: typeof result.confidence === 'number' ? result.confidence : 0,
                aiSuggested: true,
                source: 'ai',
            };
        } catch (error) {
            // Legacy callers can still use a local result, but it is never an AI reply.
            return { ...this.fallbackCategorize(description), fallback: true,
                error: errorCode(error), errorMessage: error.message || 'No AI category suggestion was received.' };
        }
    }

    /**
     * Fallback categorization using keywords
     */
    fallbackCategorize(description) {
        const lowerDesc = typeof description === 'string' ? description.toLowerCase() : '';
        if (lowerDesc.trim().length < 2) return { category: 'other', confidence: 0, aiSuggested: false, source: 'local' };

        const keywords = {
            food: ['food', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger'],
            transport: ['uber', 'ola', 'taxi', 'bus', 'train', 'metro', 'fuel', 'petrol'],
            shopping: ['shop', 'store', 'mall', 'amazon', 'flipkart', 'clothes', 'shoes'],
            entertainment: ['movie', 'cinema', 'game', 'netflix', 'spotify'],
            bills: ['bill', 'electricity', 'water', 'internet', 'mobile', 'rent'],
            health: ['medical', 'hospital', 'doctor', 'pharmacy', 'medicine']
        };

        for (const [category, words] of Object.entries(keywords)) {
            if (words.some(word => lowerDesc.includes(word))) {
                return { category, confidence: 0.7, aiSuggested: false, source: 'local' };
            }
        }

        return { category: 'other', confidence: 0.5, aiSuggested: false, source: 'local' };
    }

    /**
     * Structured receipt-text result for review tools. Never saves a transaction.
     */
    async parseReceiptTextWithAI(receiptText, { consent = false, signal } = {}) {
        try {
            assertNotCancelled(signal);
            if (consent !== true) throw serviceError('ai/consent-required', 'Review and accept AI data sharing before parsing receipt text.');
            if (typeof receiptText !== 'string' || receiptText.trim().length < 2 || receiptText.length > 6000) {
                throw serviceError('request/invalid', 'Paste receipt text of 2–6000 characters.');
            }
            const result = await requestBackend('/parse-receipt', { receiptText: receiptText.trim(), consent: true }, { signal });
            assertNotCancelled(signal);
            return { success: true, items: receiptItems(result), requiresConfirmation: true, source: 'ai' };
        } catch (error) {
            return { success: false, error: error.message || 'Unable to parse receipt text right now.', code: errorCode(error) };
        }
    }

    // Keep the legacy array/null contract for callers that have their own local parser.
    async parseReceiptWithAI(receiptText, options = {}) {
        const result = await this.parseReceiptTextWithAI(receiptText, options);
        return result.success ? result.items : null;
    }

    async getFinancialChatResponse({
        question,
        conversationHistory = [],
        consent = false,
        signal,
    }) {
        if (typeof question !== 'string' || question.trim().length < 2 || question.length > 2000) {
            return { success: false, error: 'Enter a finance-related question of 2–2000 characters.' };
        }

        try {
            assertNotCancelled(signal);
            if (consent !== true) throw Object.assign(new Error('Please review and accept AI data sharing first.'), { code: 'ai/consent-required' });
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (!timeZone) throw new Error('Your device timezone is unavailable. Set it before using AI chat.');
            // Keep only recent bounded excerpts; never forward IDs or UI-only fields.
            const history = [];
            let remaining = 4000;
            for (const message of conversationHistory.slice(-8).reverse()) {
                if (!remaining) break;
                if (!['user', 'assistant'].includes(message?.role) || typeof message.content !== 'string') continue;
                const content = message.content.trim().slice(0, Math.min(2000, remaining));
                if (!content) continue;
                history.unshift({ role: message.role, content });
                remaining -= content.length;
            }
            const result = await requestBackend('/financial-chat', {
                question: question.trim(), conversationHistory: history, consent: true, timeZone,
            }, { signal });
            assertNotCancelled(signal);
            if (typeof result?.answer !== 'string' || !result.answer.trim() || result.answer.length > 12000 ||
                !/^[a-f0-9-]{36}$/.test(result.responseId || '') || result.context?.complete !== true ||
                !/^\d{4}-\d{2}-\d{2}$/.test(result.context.period?.start || '') ||
                !/^\d{4}-\d{2}-\d{2}$/.test(result.context.period?.end || '') ||
                typeof result.context.period?.timeZone !== 'string' || !Number.isInteger(result.context.transactionCount) || result.context.transactionCount < 0) {
                throw serviceError('ai/invalid-output', 'Invalid or incomplete AI chat response.');
            }
            return { success: true, ...result, answer: this.normalizeFinancialAnswer(result.answer) };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Unable to reach the AI assistant right now.',
                code: errorCode(error),
            };
        }
    }

    /**
     * Get budget recommendations based on spending patterns
     */
    /**
     * Get budget recommendations based on spending patterns
     */
    /**
     * Get budget recommendations based on spending patterns
     */
    getBudgetRecommendations(transactions, budgets, currentMonth) {
        const recommendations = [];

        // 1. Budget Alerts (Strictly Current Month)
        const currentMonthSpending = this.calculateSpending(transactions, currentMonth);

        for (const [category, budget] of Object.entries(budgets)) {
            const spent = safeGet(currentMonthSpending, category, 0);
            const percentage = budget > 0 ? spent / budget : 0;

            if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.EXCEEDED) {
                recommendations.push(this.createExceededAlert(category, spent, budget));
            } else if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.CRITICAL) {
                recommendations.push(this.createCriticalAlert(category, spent, budget, transactions));
            } else if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.WARNING) {
                recommendations.push(this.createWarningAlert(category, spent, budget, transactions));
            }
        }

        // 2. Savings Opportunities (Rolling 30 Days)
        const lookbackDays = AI_CONFIG.RECOMMENDATIONS.LOOKBACK_DAYS || 30;
        const nonEssentialAnalysis = this.analyzeNonEssentials(transactions, lookbackDays);

        // Check ALL non-essential categories, not just the top one
        Object.entries(nonEssentialAnalysis.breakdown)
            .sort((a, b) => b[1] - a[1]) // Sort by amount desc
            .forEach(([type, amount]) => {
                // Minimum threshold per category to be worth mentioning (e.g., ₹200)
                if (amount >= (AI_CONFIG.RECOMMENDATIONS.MIN_SAVINGS_AMOUNT || 100)) {
                    recommendations.push(this.createSavingsTip(type, amount));
                }
            });

        // 3. Fallback: Monthly Review / General Insight
        // If we have few recommendations, fill with general insights
        if (recommendations.length < (AI_CONFIG.RECOMMENDATIONS.MAX_SUGGESTIONS || 3)) {
            const lastMonth = this.getPreviousMonth(currentMonth);
            const lastMonthSpending = this.calculateSpending(transactions, lastMonth);

            let maxCategory = null;
            let maxAmount = 0;

            Object.entries(lastMonthSpending).forEach(([cat, amount]) => {
                if (amount > maxAmount) {
                    maxAmount = amount;
                    maxCategory = cat;
                }
            });

            if (maxCategory && maxAmount > 0) {
                recommendations.push({
                    type: 'tip',
                    title: 'Spending Pattern',
                    message: `In ${this.getMonthName(lastMonth)}, spending was highest in ${maxCategory} (₹${maxAmount.toFixed(0)}).`,
                    icon: '📊', // changed icon to chart
                    suggestions: [
                        `Review your ${maxCategory} expenses`,
                        `Try to keep it under ₹${(maxAmount * 0.9).toFixed(0)} this month`
                    ]
                });
            }
        }

        // Sort by priority
        recommendations.sort((a, b) => {
            const priority = { critical: 3, warning: 2, tip: 1 };
            return safeGet(priority, b.type, 0) - safeGet(priority, a.type, 0);
        });

        // Ensure we don't return duplicates or too many
        return recommendations.slice(0, AI_CONFIG.RECOMMENDATIONS.MAX_SUGGESTIONS);
    }

    /**
     * Get previous month string YYYY-MM
     */
    getPreviousMonth(currentMonth) {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month - 2, 1); // month is 1-based, so month-2 gives previous month index
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Get month name
     */
    getMonthName(monthStr) {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleString('default', { month: 'long' });
    }

    /**
     * Calculate spending by category for specific month
     */
    calculateSpending(transactions, targetMonth) {
        const spending = {};

        transactions.forEach(transaction => {
            // Handle both date object and string formats
            const tDate = new Date(transaction.date || transaction.createdAt);
            const tMonth = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;

            if (tMonth === targetMonth && transaction.type === 'expense') {
                const category = transaction.category || 'other';
                const current = safeGet(spending, category, 0);
                safeSet(spending, category, current + transaction.amount);
            }
        });

        return spending;
    }

    /**
     * Analyze non-essential spending for last N days
     */
    analyzeNonEssentials(transactions, lookbackDays) {
        const breakdown = {};
        let totalAmount = 0;

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

        transactions.forEach(transaction => {
            const tDate = new Date(transaction.date || transaction.createdAt);

            // Check if transaction is within lookback period
            if (tDate >= cutoffDate && transaction.type === 'expense') {
                const desc = (transaction.description || '').toLowerCase();

                // Check against non-essential keywords
                for (const [type, keywords] of Object.entries(AI_CONFIG.NON_ESSENTIAL_KEYWORDS)) {
                    if (keywords.some(keyword => desc.includes(keyword))) {
                        const current = safeGet(breakdown, type, 0);
                        safeSet(breakdown, type, current + transaction.amount);
                        totalAmount += transaction.amount;
                        break;
                    }
                }
            }
        });

        return { breakdown, totalAmount };
    }

    /**
     * Create budget exceeded alert
     */
    createExceededAlert(category, spent, budget) {
        const exceeded = spent - budget;
        return {
            type: 'critical',
            title: `${category.charAt(0).toUpperCase() + category.slice(1)} Budget Exceeded!`,
            message: `You've exceeded your budget by ₹${exceeded.toFixed(0)}`,
            icon: '🚨',
            suggestions: [
                `Stop all non-essential ${category} expenses`,
                'Review and cut unnecessary spending',
                'Consider adjusting your budget for next month'
            ]
        };
    }

    /**
     * Create critical budget alert
     */
    createCriticalAlert(category, spent, budget, transactions) {
        const remaining = budget - spent;
        const percentage = ((spent / budget) * 100).toFixed(0);

        return {
            type: 'critical',
            title: `${category.charAt(0).toUpperCase() + category.slice(1)} Budget Critical`,
            message: `${percentage}% used! Only ₹${remaining.toFixed(0)} left`,
            icon: '⚠️',
            suggestions: this.getCategorySuggestions(category, 'critical')
        };
    }

    /**
     * Create warning alert
     */
    createWarningAlert(category, spent, budget, transactions) {
        const remaining = budget - spent;
        const percentage = ((spent / budget) * 100).toFixed(0);

        return {
            type: 'warning',
            title: `${category.charAt(0).toUpperCase() + category.slice(1)} Budget Alert`,
            message: `${percentage}% used (₹${spent.toFixed(0)}/₹${budget.toFixed(0)})`,
            icon: '💡',
            suggestions: this.getCategorySuggestions(category, 'warning')
        };
    }

    /**
     * Create savings tip
     */
    createSavingsTip(type, amount) {
        const potentialSavings = (amount * 0.5).toFixed(0);

        // Improve titles based on type
        const titles = {
            coffee: 'Caffeine Curb',
            diningOut: 'Home Cooking',
            snacks: 'Snack Attack',
            coldDrinks: 'Drink Water',
            alcohol: 'Sober Savings',
            shopping: 'Smart Shopper',
            electronics: 'Tech Diet',
            entertainment: 'Entertainment Check',
            subscriptions: 'Sub Switch',
            personalCare: 'Grooming Goals',
            travel: 'Travel Thrifty'
        };

        return {
            type: 'tip',
            title: safeGet(titles, type, 'Savings Opportunity'),
            message: `You've spent ₹${amount.toFixed(0)} on ${type} recently.`,
            icon: '💰',
            suggestions: [
                `Cut ${type} expenses to save ₹${potentialSavings}`,
                this.getAlternativeSuggestion(type)
            ]
        };
    }

    /**
     * Get category-specific suggestions
     */
    getCategorySuggestions(category, severity) {
        const suggestions = {
            food: {
                critical: [
                    'Cook at home instead of dining out',
                    'Avoid coffee shops and cafes',
                    'Skip cold drinks and snacks',
                    'Buy groceries, not ready-made food'
                ],
                warning: [
                    'Reduce restaurant visits',
                    'Make coffee at home',
                    'Pack lunch instead of ordering'
                ]
            },
            transport: {
                critical: [
                    'Use public transport',
                    'Carpool with colleagues',
                    'Walk or bike for short distances'
                ],
                warning: [
                    'Combine trips to save fuel',
                    'Consider monthly passes',
                    'Use shared rides'
                ]
            },
            shopping: {
                critical: [
                    'Avoid impulse purchases',
                    'Buy only essentials',
                    'Wait for sales'
                ],
                warning: [
                    'Make a shopping list',
                    'Compare prices before buying',
                    'Avoid window shopping'
                ]
            },
            entertainment: {
                critical: [
                    'Skip movies and events',
                    'Use free entertainment options',
                    'Cancel unused subscriptions'
                ],
                warning: [
                    'Limit entertainment expenses',
                    'Choose cheaper alternatives',
                    'Share subscriptions'
                ]
            }
        };

        const categorySuggestions = safeGet(suggestions, category);
        if (categorySuggestions) {
            const severitySuggestions = safeGet(categorySuggestions, severity);
            if (severitySuggestions) return severitySuggestions;
        }
        return [
            'Review your spending',
            'Cut unnecessary expenses',
            'Stick to essentials only'
        ];
    }

    /**
     * Get alternative suggestion for non-essential items
     */
    getAlternativeSuggestion(type) {
        const alternatives = {
            coffee: 'Make coffee at home - saves ₹100/day',
            coldDrinks: 'Drink water or homemade juice instead',
            snacks: 'Prepare healthy snacks at home',
            diningOut: 'Cook meals at home - healthier and cheaper',
            entertainment: 'Try free activities like parks, reading'
        };

        return safeGet(alternatives, type, 'Find cheaper alternatives');
    }
}

export default new AIService();
