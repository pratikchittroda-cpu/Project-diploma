// Public, local heuristics only. Provider credentials belong in server secrets.
export const AI_CONFIG = {
    BUDGET_THRESHOLDS: { WARNING: 0.7, CRITICAL: 0.9, EXCEEDED: 1 },
    RECOMMENDATIONS: { MIN_SAVINGS_AMOUNT: 100, LOOKBACK_DAYS: 30, MAX_SUGGESTIONS: 3 },
    NON_ESSENTIAL_KEYWORDS: {
        coffee: ['coffee', 'cafe', 'starbucks', 'latte', 'chai'],
        diningOut: ['restaurant', 'dining', 'zomato', 'swiggy', 'pizza', 'burger'],
        snacks: ['chips', 'snacks', 'chocolate', 'candy', 'biscuit', 'cookies'],
        coldDrinks: ['coke', 'pepsi', 'soda', 'cold drink', 'soft drink', 'juice'],
        alcohol: ['alcohol', 'beer', 'wine', 'liquor', 'pub', 'whisky'],
        shopping: ['shop', 'store', 'mall', 'amazon', 'flipkart', 'clothes', 'shoes'],
        electronics: ['gadget', 'electronic', 'laptop', 'tablet', 'headphones'],
        entertainment: ['movie', 'cinema', 'concert', 'game', 'gaming'],
        subscriptions: ['netflix', 'spotify', 'subscription', 'membership'],
        personalCare: ['salon', 'spa', 'haircut', 'makeup', 'cosmetics'],
        travel: ['trip', 'vacation', 'holiday', 'resort', 'airbnb', 'flight'],
    },
};
