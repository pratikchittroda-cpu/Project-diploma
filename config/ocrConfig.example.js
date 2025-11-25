import { OCR_SPACE_API_KEY } from '@env';

// OCR Configuration
export const OCR_CONFIG = {
    // OCR.space API
    API_KEY: OCR_SPACE_API_KEY,
    API_ENDPOINT: 'https://api.ocr.space/parse/image',

    // OCR Engine (1 or 2, engine 2 is more accurate)
    OCR_ENGINE: 2,

    // Language
    LANGUAGE: 'eng',

    // Category keywords for auto-categorization
    CATEGORY_KEYWORDS: {
        food: ['restaurant', 'cafe', 'coffee', 'food', 'pizza', 'burger', 'grocery', 'supermarket'],
        transport: ['uber', 'ola', 'taxi', 'fuel', 'petrol', 'gas', 'parking', 'toll'],
        shopping: ['mall', 'store', 'shop', 'amazon', 'flipkart', 'retail'],
        entertainment: ['cinema', 'movie', 'pvr', 'inox', 'netflix', 'spotify'],
        bills: ['electricity', 'water', 'internet', 'mobile', 'phone', 'utility'],
        health: ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor']
    },

    // Lines to skip during parsing
    SKIP_KEYWORDS: [
        'total', 'subtotal', 'sub-total', 'grand total',
        'tax', 'vat', 'gst', 'cgst', 'sgst', 'service charge', 'discount',
        'cash', 'card', 'payment', 'change', 'balance', 'paid',
        'thank you', 'thanks', 'visit', 'address', 'phone', 'email',
        'receipt', 'invoice', 'bill no', 'date', 'time', 'Subtotal', 'Sales Tax'
    ],
};
