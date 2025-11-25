import { AI_CONFIG } from '../config/aiConfig';

class AIService {
    /**
     * Categorize transaction using AI
     */
    async categorizeTransaction(description) {
        if (!description || description.length < 2) {
            return { category: 'other', confidence: 0 };
        }

        try {
            console.log('AI: Categorizing transaction:', description);

            // Use a reliable model for categorization (overriding config if needed)
            // Switched to mDeBERTa as BART was returning 410
            const response = await fetch('https://api-inference.huggingface.co/models/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AI_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: description,
                    parameters: {
                        candidate_labels: AI_CONFIG.CATEGORIES,
                        multi_label: false
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`AI API error: ${response.status}`);
            }

            const result = await response.json();

            // Get the top category
            const topLabel = result.labels[0];
            const confidence = result.scores[0];

            // Map to app category
            const category = AI_CONFIG.CATEGORY_MAP[topLabel] || 'other';

            console.log(`AI: Categorized as "${category}" (${(confidence * 100).toFixed(0)}% confidence)`);

            return {
                category,
                confidence,
                aiSuggested: true
            };
        } catch (error) {
            console.error('AI categorization error:', error);

            // Fallback to keyword matching
            return this.fallbackCategorize(description);
        }
    }

    /**
     * Fallback categorization using keywords
     */
    fallbackCategorize(description) {
        const lowerDesc = description.toLowerCase();

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
                return { category, confidence: 0.7, aiSuggested: false };
            }
        }

        return { category: 'other', confidence: 0.5, aiSuggested: false };
    }

    /**
     * Parse receipt text using AI (experimental)
     * Uses AI to extract line items from receipt text
     */
    async parseReceiptWithAI(receiptText) {
        try {
            console.log('🤖 AI: Parsing receipt with AI...');

            // Create a smart prompt for the AI to extract items
            const prompt = `Analyze this receipt text and extract valid line items.
            
Rules:
1. Pair each product description with its correct price.
2. Handle different layouts:
   - Same line: "Coffee 5.00"
   - Two columns: Items listed first, then prices later. Match them by order.
   - Columnar Blocks: A block of descriptions followed by a block of prices.
   - Next line: Item on one line, price on next.
3. Ignore totals, subtotals, taxes, cash, change, and payment details.
4. Convert all prices to numbers.

Receipt text:
${receiptText}

Return ONLY a valid JSON array of objects with 'description' and 'amount' fields. No other text.
Example: [{"description": "Coffee", "amount": 5.00}, {"description": "Pizza", "amount": 12.50}]`;

            // Switched to Zephyr-7b-beta as Mistral was returning 410 Gone
            const response = await fetch('https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AI_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 500,
                        temperature: 0.1,
                        return_full_text: false
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`AI parsing error: ${response.status}`);
            }

            const result = await response.json();
            const generatedText = result[0]?.generated_text || '';

            // Try to extract JSON from the response
            const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const items = JSON.parse(jsonMatch[0]);
                console.log('✅ AI parsed items:', items);
                return items;
            }

            throw new Error('Could not parse AI response');
        } catch (error) {
            console.error('AI parsing failed:', error);
            return null; // Return null to fall back to regex parsing
        }
    }

    /**
     * Get budget recommendations based on spending patterns
     */
    getBudgetRecommendations(transactions, budgets, currentMonth) {
        const recommendations = [];

        // Calculate spending by category
        const spending = this.calculateSpending(transactions, currentMonth);

        // Check each budget
        for (const [category, budget] of Object.entries(budgets)) {
            const spent = spending[category] || 0;
            const percentage = budget > 0 ? spent / budget : 0;

            // Budget warnings
            if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.EXCEEDED) {
                recommendations.push(this.createExceededAlert(category, spent, budget));
            } else if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.CRITICAL) {
                recommendations.push(this.createCriticalAlert(category, spent, budget, transactions));
            } else if (percentage >= AI_CONFIG.BUDGET_THRESHOLDS.WARNING) {
                recommendations.push(this.createWarningAlert(category, spent, budget, transactions));
            }
        }

        // Analyze non-essential spending
        const nonEssentialAnalysis = this.analyzeNonEssentials(transactions, currentMonth);
        if (nonEssentialAnalysis.totalAmount >= AI_CONFIG.RECOMMENDATIONS.MIN_SAVINGS_AMOUNT) {
            recommendations.push(this.createSavingsTip(nonEssentialAnalysis));
        }

        // Sort by priority (critical > warning > tip)
        recommendations.sort((a, b) => {
            const priority = { critical: 3, warning: 2, tip: 1 };
            return (priority[b.type] || 0) - (priority[a.type] || 0);
        });

        return recommendations.slice(0, AI_CONFIG.RECOMMENDATIONS.MAX_SUGGESTIONS);
    }

    /**
     * Calculate spending by category for current month
     */
    calculateSpending(transactions, currentMonth) {
        const spending = {};

        transactions.forEach(transaction => {
            const transactionDate = new Date(transaction.date);
            const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;

            if (transactionMonth === currentMonth && transaction.type === 'expense') {
                const category = transaction.category || 'other';
                spending[category] = (spending[category] || 0) + transaction.amount;
            }
        });

        return spending;
    }

    /**
     * Analyze non-essential spending
     */
    analyzeNonEssentials(transactions, currentMonth) {
        const breakdown = {};
        let totalAmount = 0;

        transactions.forEach(transaction => {
            const transactionDate = new Date(transaction.date);
            const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;

            if (transactionMonth === currentMonth && transaction.type === 'expense') {
                const desc = transaction.description.toLowerCase();

                // Check against non-essential keywords
                for (const [type, keywords] of Object.entries(AI_CONFIG.NON_ESSENTIAL_KEYWORDS)) {
                    if (keywords.some(keyword => desc.includes(keyword))) {
                        breakdown[type] = (breakdown[type] || 0) + transaction.amount;
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
    createSavingsTip(analysis) {
        const topCategory = Object.entries(analysis.breakdown)
            .sort((a, b) => b[1] - a[1])[0];

        const [type, amount] = topCategory;
        const potentialSavings = (amount * 0.5).toFixed(0);

        return {
            type: 'tip',
            title: 'Savings Opportunity',
            message: `You've spent ₹${amount.toFixed(0)} on ${type} this month`,
            icon: '💰',
            suggestions: [
                `Cut ${type} expenses by 50% to save ₹${potentialSavings}`,
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

        return suggestions[category]?.[severity] || [
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

        return alternatives[type] || 'Find cheaper alternatives';
    }
}

export default new AIService();
