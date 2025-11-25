import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { OCR_CONFIG } from '../config/ocrConfig';
import aiService from './aiService';

class OCRService {
    /**
     * Scan receipt and extract line items
     */
    async scanReceipt(imageUri) {
        try {
            console.log('🔍 Starting OCR scan...');

            // 1. Compress image
            const compressedUri = await this.compressImage(imageUri);

            // 2. Convert to base64
            const base64Image = await this.imageToBase64(compressedUri);

            // 3. Call OCR API
            const ocrText = await this.callOCRAPI(base64Image);

            // 4. Try AI parsing first (experimental)
            console.log('🤖 Attempting AI-powered parsing...');
            let receiptData;

            // Try AI parsing
            const aiParsedItems = await aiService.parseReceiptWithAI(ocrText);

            if (aiParsedItems && aiParsedItems.length > 0) {
                console.log('✅ Using AI-parsed items');
                receiptData = {
                    items: aiParsedItems,
                    merchant: this.extractMerchant(ocrText),
                    date: this.extractDate(ocrText)
                };
            } else {
                console.log('⚠️ AI parsing failed or returned no items, using regex fallback');
                console.log('📝 Using regex parsing...');
                receiptData = this.parseReceiptLineItems(ocrText);
            }

            // 5. Use AI to categorize each item
            console.log('🤖 Using AI to categorize items...');
            const itemsWithAI = await Promise.all(
                receiptData.items.map(async (item) => {
                    try {
                        const aiResult = await aiService.categorizeTransaction(item.description);
                        return {
                            ...item,
                            category: aiResult.category,
                            aiSuggested: aiResult.aiSuggested,
                            confidence: aiResult.confidence
                        };
                    } catch (error) {
                        console.error('AI categorization failed for:', item.description);
                        return item; // Keep original if AI fails
                    }
                })
            );

            console.log('✅ OCR + AI complete:', itemsWithAI.length, 'items');

            return {
                success: true,
                data: {
                    ...receiptData,
                    items: itemsWithAI
                },
                rawText: ocrText,
            };
        } catch (error) {
            console.error('OCR Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to scan receipt',
            };
        }
    }

    /**
     * Compress image for faster upload
     */
    async compressImage(uri) {
        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result.uri;
        } catch (error) {
            console.warn('Image compression failed, using original', error);
            return uri;
        }
    }

    /**
     * Convert image to base64
     */
    async imageToBase64(imageUri) {
        try {
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            return `data:image/jpeg;base64,${base64}`;
        } catch (error) {
            throw new Error('Failed to read image file');
        }
    }

    /**
     * Call OCR.space API
     */
    async callOCRAPI(base64Image) {
        const formData = new FormData();
        formData.append('base64Image', base64Image);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2'); // Engine 2 is more accurate

        try {
            console.log('Sending request to OCR.space API...');
            const response = await fetch(OCR_CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'apikey': OCR_CONFIG.API_KEY,
                },
                body: formData,
            });

            const result = await response.json();

            if (result.IsErroredOnProcessing) {
                throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
            }

            if (result.ParsedResults && result.ParsedResults.length > 0) {
                return result.ParsedResults[0].ParsedText;
            }

            throw new Error('No text detected in image');
        } catch (error) {
            console.error('OCR API Error:', error);
            throw error;
        }
    }

    /**
     * Parse OCR text into line items
     */
    parseReceiptLineItems(text) {
        if (!text) return { items: [], merchant: '', date: new Date().toISOString().split('T')[0] };

        console.log('=== RAW OCR TEXT ===');
        console.log(text);
        console.log('===================');

        const lines = text.split(/[\r\n]+/).map(line => line.trim()).filter(line => line.length > 0);

        console.log('=== LINES ===');
        lines.forEach((line, i) => console.log(`${i}: "${line}"`));
        console.log('=============');

        // Extract merchant (usually first non-empty line)
        const merchant = lines[0] || '';

        // Extract date
        const date = this.extractDate(text) || new Date().toISOString().split('T')[0];

        // Find the start of items section (look for QTY or similar)
        let itemsStartIndex = -1;
        let descStartIndex = -1;
        let amountStartIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (/^qty$/i.test(lines[i])) {
                itemsStartIndex = i;
                console.log('Found QTY at line', i);
            }
            if (/^description$/i.test(lines[i])) {
                descStartIndex = i;
                console.log('Found DESCRIPTION at line', i);
            }
            if (/^amount$/i.test(lines[i])) {
                amountStartIndex = i;
                console.log('Found AMOUNT at line', i);
                break; // Stop after finding AMOUNT
            }
        }

        const items = [];

        // If we found the table structure
        if (descStartIndex !== -1 && amountStartIndex !== -1) {
            console.log('Using table structure parsing');

            // First, count how many items by looking at QTY numbers
            let itemCount = 0;
            if (itemsStartIndex !== -1) {
                for (let i = itemsStartIndex + 1; i < descStartIndex; i++) {
                    if (/^\d+$/.test(lines[i])) {
                        itemCount++;
                        console.log('Found QTY number:', lines[i]);
                    }
                }
            }
            console.log('Expected item count from QTY:', itemCount);

            // Collect descriptions (between DESCRIPTION and AMOUNT, limited by itemCount)
            const descriptions = [];
            for (let i = descStartIndex + 1; i < amountStartIndex && (itemCount === 0 || descriptions.length < itemCount); i++) {
                const line = lines[i];

                // Skip section headers, metadata fields, pure numbers, dates, and price-like patterns
                if (!/^(qty|unit price|logo|receipt|total|receipt #|receipt date|p\.o\.#|due date|bill to|ship to)$/i.test(line) &&
                    !/^\d+$/.test(line) &&
                    !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line) &&
                    !/^\$?\d+\.?\d*$/.test(line) && // Skip lines that are just prices
                    line.length > 2) {
                    descriptions.push(line);
                    console.log('Description:', line);
                }
            }

            // Collect amounts (after AMOUNT header, limited by itemCount)
            const amounts = [];
            for (let i = amountStartIndex + 1; i < lines.length && (itemCount === 0 || amounts.length < itemCount); i++) {
                const line = lines[i];

                // Match price pattern
                const priceMatch = line.match(/^\$?(\d+\.?\d*)$/);
                if (priceMatch) {
                    const amount = parseFloat(priceMatch[1]);
                    if (amount > 0 && amount < 100000) {
                        amounts.push(amount);
                        console.log('Amount:', amount);
                    }
                }
            }

            console.log('Descriptions:', descriptions);
            console.log('Amounts:', amounts);

            // Match descriptions with amounts (use itemCount if available)
            const matchCount = itemCount > 0 ? Math.min(itemCount, descriptions.length, amounts.length) : Math.min(descriptions.length, amounts.length);
            for (let i = 0; i < matchCount; i++) {
                items.push({
                    description: descriptions[i],
                    amount: amounts[i],
                    quantity: 1,
                    category: this.categorizeItem(descriptions[i]),
                });
                console.log(`✓ Matched: "${descriptions[i]}" → $${amounts[i]}`);
            }
        }

        // Fallback: try line-by-line parsing
        if (items.length === 0) {
            console.log('Table parsing failed, trying line-by-line...');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (this.shouldSkipLine(line)) {
                    continue;
                }

                const lineItem = this.parseLineItem(line);

                if (lineItem) {
                    items.push({
                        description: lineItem.description,
                        amount: lineItem.amount,
                        quantity: lineItem.quantity,
                        category: this.categorizeItem(lineItem.description),
                    });
                    console.log(`✓ Parsed: "${line}" → ${lineItem.description} - $${lineItem.amount}`);
                }
            }
        }

        // Strategy 3: Try detecting two-column layout (items section, then prices section)
        if (items.length === 0) {
            console.log('Line-by-line failed, trying two-column detection...');

            const itemCandidates = [];
            const allPrices = [];

            // Collect all items and all prices separately
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check if line is a price
                const priceMatch = line.match(/^\$?(\d+\.?\d*)$/);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    if (price > 0 && price < 100000) {
                        allPrices.push({ line: i, value: price });
                    }
                } else if (!this.shouldSkipLine(line) && line.length > 2 && !/^[\d:]+$/.test(line) && !/^(total|sub-total|subtotal|sales tax|tax|balance|cash|change|tendered|payment|card|credit|debit)$/i.test(line)) {
                    // Not a price, not a skip line, not time format, not total/payment keywords
                    // Also skip lines that look like amounts with currency symbols
                    if (!/^\$\s*\d+/.test(line)) {
                        itemCandidates.push({ line: i, text: line });
                    }
                }
            }

            console.log('Item candidates:', itemCandidates.map(c => c.text));
            console.log('All prices found:', allPrices.map(c => c.value));

            // Smart filtering: Take the first N prices where N = number of items
            // This assumes item prices come before subtotal/tax/total
            if (itemCandidates.length > 0 && allPrices.length >= itemCandidates.length) {
                const priceCandidates = allPrices.slice(0, itemCandidates.length);
                console.log('Using prices:', priceCandidates.map(c => c.value));

                // Match by position
                for (let i = 0; i < itemCandidates.length; i++) {
                    items.push({
                        description: itemCandidates[i].text,
                        amount: priceCandidates[i].value,
                        quantity: 1,
                        category: this.categorizeItem(itemCandidates[i].text),
                    });
                    console.log(`✓ Matched: "${itemCandidates[i].text}" → $${priceCandidates[i].value}`);
                }
            } else if (itemCandidates.length > 0 && allPrices.length > 0) {
                // Fallback: match what we have
                const matchCount = Math.min(itemCandidates.length, allPrices.length);
                for (let i = 0; i < matchCount; i++) {
                    items.push({
                        description: itemCandidates[i].text,
                        amount: allPrices[i].value,
                        quantity: 1,
                        category: this.categorizeItem(itemCandidates[i].text),
                    });
                    console.log(`✓ Matched: "${itemCandidates[i].text}" → $${allPrices[i].value}`);
                }
            }
        }

        // Strategy 4: Try pairing consecutive lines (item then price)
        if (items.length === 0) {
            console.log('Two-column failed, trying item-price pairing...');

            for (let i = 0; i < lines.length - 1; i++) {
                const currentLine = lines[i];
                const nextLine = lines[i + 1];

                // Skip headers and metadata
                if (this.shouldSkipLine(currentLine)) continue;

                // Check if current line is NOT a price but next line IS a price
                const isCurrentPrice = /^\$?\d+\.?\d*$/.test(currentLine);
                const nextPriceMatch = nextLine.match(/^\$?(\d+\.?\d*)$/);

                if (!isCurrentPrice && nextPriceMatch && currentLine.length > 2) {
                    const amount = parseFloat(nextPriceMatch[1]);
                    if (amount > 0 && amount < 10000) {
                        items.push({
                            description: currentLine,
                            amount: amount,
                            quantity: 1,
                            category: this.categorizeItem(currentLine),
                        });
                        console.log(`✓ Paired: "${currentLine}" → $${amount}`);
                        i++; // Skip the price line
                    }
                }
            }

            // Stop before totals section
            const filteredItems = [];
            for (const item of items) {
                if (!/subtotal|sub-total|sales tax|tax|total|balance/i.test(item.description)) {
                    filteredItems.push(item);
                } else {
                    console.log('Stopping at:', item.description);
                    break;
                }
            }
            items.length = 0;
            items.push(...filteredItems);
        }

        console.log(`=== FINAL: Found ${items.length} items ===`);

        // Fallback: if no items found, try to extract the total amount
        if (items.length === 0) {
            console.log('No items found, looking for total amount...');

            // Look for total amount (usually after "Total" or "Balance" keyword)
            for (let i = 0; i < lines.length; i++) {
                if (/^(total|balance|grand total)$/i.test(lines[i])) {
                    console.log('Found total keyword at line', i, ':', lines[i]);
                    // Check next 10 lines for a price (increased from 5)
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const priceMatch = lines[j].match(/^\$?(\d+\.?\d*)$/);
                        if (priceMatch) {
                            const totalAmount = parseFloat(priceMatch[1]);
                            console.log('Checking amount at line', j, ':', totalAmount);
                            if (totalAmount > 0 && totalAmount < 100000) {
                                console.log('✓ Using total amount:', totalAmount);
                                items.push({
                                    description: `Receipt from ${merchant}`,
                                    amount: totalAmount,
                                    quantity: 1,
                                    category: 'other',
                                });
                                break;
                            }
                        }
                    }
                    if (items.length > 0) break;
                }
            }

            if (items.length === 0) {
                console.log('Could not find total amount');
            }
        }

        return {
            items,
            merchant,
            date,
        };
    }

    /**
     * Extract date from text
     */
    extractDate(text) {
        const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
        const match = text.match(datePattern);

        if (match) {
            try {
                const dateParts = match[1].split(/[-/]/);
                let day, month, year;

                if (dateParts[2].length === 4) {
                    // DD-MM-YYYY or MM-DD-YYYY
                    day = parseInt(dateParts[0]);
                    month = parseInt(dateParts[1]);
                    year = parseInt(dateParts[2]);
                } else {
                    // DD-MM-YY or MM-DD-YY
                    day = parseInt(dateParts[0]);
                    month = parseInt(dateParts[1]);
                    year = 2000 + parseInt(dateParts[2]);
                }

                // Assume DD-MM-YYYY format (common in India)
                const date = new Date(year, month - 1, day);
                return date.toISOString().split('T')[0];
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    /**
     * Check if line should be skipped
     */
    shouldSkipLine(line) {
        const lowerLine = line.toLowerCase();

        // Skip common keywords
        for (const keyword of OCR_CONFIG.SKIP_KEYWORDS) {
            if (lowerLine.includes(keyword.toLowerCase())) {
                return true;
            }
        }

        // Skip common receipt headers/footers
        const headerPatterns = [
            /^(address|addr|tel|phone|email|website|www)/i,
            /^(cashier|server|table|order|ticket)/i,
            /^(open|close|time|date):/i,
            /^(thank you|thanks|welcome|visit)/i,
            /^(cash|credit|debit|card|payment method)/i,
            /^(change|tendered|received)/i,
        ];

        for (const pattern of headerPatterns) {
            if (pattern.test(line)) {
                return true;
            }
        }

        // Skip very short lines or lines with only special characters
        if (line.length < 3 || /^[^a-zA-Z0-9]+$/.test(line)) {
            return true;
        }

        // Skip lines that are just numbers (but not prices)
        if (/^\d+$/.test(line) && !(/^\d{1,4}$/.test(line))) {
            return true;
        }

        return false;
    }

    /**
     * Parse single line item - improved to handle more formats
     */
    parseLineItem(line) {
        // Clean the line
        const cleanLine = line.trim();

        // Try to find any number that looks like a price
        const pricePatterns = [
            // Standard: "Item 10.00" or "Item 10"
            /^(.+?)\s+(\d+(?:\.\d{1,2})?)\s*$/,
            // With currency: "Item Rs.10" or "Item ₹10"
            /^(.+?)\s+(?:rs\.?|₹|inr)\s*(\d+(?:\.\d{1,2})?)/i,
            // Price first: "10.00 Item" or "Rs.10 Item"
            /^(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d{1,2})?)\s+(.+)$/i,
            // With quantity: "2x Item 10.00"
            /^(\d+)\s*x\s+(.+?)\s+(\d+(?:\.\d{1,2})?)$/i,
            // Dots between: "Item ... 10.00"
            /^(.+?)\s*\.{2,}\s*(\d+(?:\.\d{1,2})?)$/,
        ];

        for (const pattern of pricePatterns) {
            const match = cleanLine.match(pattern);
            if (match) {
                let description, amount, quantity = 1;

                if (pattern.source.includes('x')) {
                    // Quantity pattern
                    quantity = parseInt(match[1]);
                    description = match[2].trim();
                    amount = parseFloat(match[3]);
                } else if (pattern.source.startsWith('^(?:rs')) {
                    // Price first pattern
                    amount = parseFloat(match[1]);
                    description = match[2].trim();
                } else {
                    // Standard patterns
                    description = match[1].trim();
                    amount = parseFloat(match[2]);
                }

                // Validate
                if (!isNaN(amount) && amount > 0 && amount < 100000 && description.length > 0) {
                    // Clean up description - remove trailing punctuation
                    description = description.replace(/[.:,;]+$/, '').trim();

                    // Skip if description is too short or just numbers
                    if (description.length < 2 || /^\d+$/.test(description)) {
                        continue;
                    }

                    return {
                        description: description || 'Item',
                        amount,
                        quantity,
                    };
                }
            }
        }

        return null;
    }

    /**
     * Categorize item based on description
     */
    categorizeItem(itemDescription) {
        const searchText = itemDescription.toLowerCase();

        for (const [category, keywords] of Object.entries(OCR_CONFIG.CATEGORY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (searchText.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }

        return 'other';
    }
}

export default new OCRService();
