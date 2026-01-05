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
        coffee: ['coffee', 'cafe', 'starbucks', 'cafe coffee day', 'barista', 'cappuccino', 'latte', 'espresso', 'tea point', 'chai', 'chaayos', 'chai point', 'blue tokai', 'third wave', 'tim hortons', 'dunkin'],
        diningOut: ['restaurant', 'dining', 'food delivery', 'zomato', 'swiggy', 'uber eats', 'pizza', 'burger', 'dominos', 'mcdonalds', 'kfc', 'burger king', 'subway', 'taco bell', 'pizza hut', 'haldiram', 'bikanervala', 'wow momo', 'biryani', 'behrouz', 'faasos', 'box8', 'ovenstory', 'lunchbox', 'dessert', 'ice cream', 'baskin robbins', 'naturals', 'iani', 'hotel', 'barbeque', 'buffet', 'fine dine', 'bistro', 'diner'],
        snacks: ['chips', 'snacks', 'chocolate', 'candy', 'biscuit', 'cookies', 'maggi', 'kurkure', 'lay\'s', 'doritos', 'pringles', 'namkeen', 'popcorn', 'cake', 'pastry', 'donut', 'brownie', 'waffle'],
        coldDrinks: ['coke', 'pepsi', 'soda', 'cold drink', 'soft drink', 'juice', 'smoothie', 'shake', 'red bull', 'monster', 'thums up', 'sprite', 'fanta', 'maaza', 'slice', 'limca', 'mountain dew', 'sting'],
        alcohol: ['alcohol', 'beer', 'wine', 'liquor', 'bar', 'pub', 'club', 'whisky', 'vodka', 'rum', 'gin', 'tequila', 'cocktail', 'mocktail', 'brewery', 'theka', 'wine shop'],
        shopping: ['shop', 'store', 'mall', 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'snapdeal', 'zara', 'h&m', 'uniqlo', 'trends', 'westside', 'pantaloons', 'max', 'lifestyle', 'shoppers stop', 'fabindia', 'marks & spencer', 'decathlon', 'adidas', 'nike', 'puma', 'reebok', 'levis', 'clothes', 'shoes', 'accessories', 'bag', 'watch', 'sunglasses', 'jewelry'],
        electronics: ['gadget', 'electronic', 'mobile', 'phone', 'laptop', 'tablet', 'ipad', 'headphones', 'earbuds', 'speaker', 'camera', 'console', 'apple', 'samsung', 'oneplus', 'xiaomi', 'realme', 'vivo', 'oppo', 'sony', 'boat', 'noise', 'jbl', 'bose', 'croma', 'reliance digital', 'vijay sales'],
        entertainment: ['movie', 'cinema', 'pvr', 'inox', 'cinepolis', 'ticket', 'show', 'concert', 'event', 'standup', 'bookmyshow', 'insider', 'game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'epic games', 'wonderla', 'imagica', 'bowling', 'arcade'],
        subscriptions: ['netflix', 'prime video', 'disney+', 'hotstar', 'spotify', 'apple music', 'youtube premium', 'gaana', 'jiosaavn', 'wynk', 'audible', 'kindle', 'subscription', 'membership', 'gym', 'cult.fit', 'gold\'s gym', 'fitness center', 'club membership', 'tinder', 'bumble', 'hinge'],
        personalCare: ['salon', 'spa', 'massage', 'haircut', 'barber', 'parlour', 'urban company', 'makeup', 'cosmetics', 'facial', 'manicure', 'pedicure', 'grooming', 'skincare'],
        travel: ['trip', 'vacation', 'holiday', 'resort', 'airbnb', 'oyo', 'staycation', 'makemytrip', 'goibibo', 'easemytrip', 'cleartrip', 'indigo', 'vistara', 'air asia', 'spicejet', 'flight', 'booking.com', 'agoda']
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
