# Local AI & n8n Integration Guide

## 🏠 **Local AI Implementation**

### **Option 1: TensorFlow.js (On-Device AI)**

#### **Setup:**
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow/tfjs-platform-react-native
```

#### **Initialize TensorFlow in your app:**
```javascript
// App.js - Add this before your main component
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-platform-react-native';

// Initialize TensorFlow
import * as tf from '@tensorflow/tfjs';

export default function App() {
  useEffect(() => {
    // Initialize TensorFlow
    tf.ready().then(() => {
      console.log('TensorFlow.js is ready!');
    });
  }, []);

  // Rest of your app...
}
```

#### **Create Local AI Service:**
```javascript
// services/localAIService.js
import * as tf from '@tensorflow/tfjs';

class LocalAIService {
  constructor() {
    this.categoryModel = null;
    this.categories = ['food', 'bills', 'shopping', 'transport', 'entertainment', 'healthcare', 'others'];
    this.initializeModel();
  }

  async initializeModel() {
    try {
      // Option 1: Load pre-trained model
      // this.categoryModel = await tf.loadLayersModel('path/to/model.json');
      
      // Option 2: Create simple rule-based model
      this.createRuleBasedModel();
    } catch (error) {
      console.error('Failed to initialize AI model:', error);
    }
  }

  createRuleBasedModel() {
    // Simple keyword-based categorization
    this.keywordMap = {
      food: ['restaurant', 'grocery', 'food', 'cafe', 'pizza', 'burger', 'starbucks', 'mcdonalds', 'subway'],
      bills: ['electric', 'gas', 'water', 'internet', 'phone', 'rent', 'mortgage', 'insurance'],
      shopping: ['amazon', 'walmart', 'target', 'mall', 'store', 'shop', 'clothing', 'shoes'],
      transport: ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'bus', 'train', 'parking'],
      entertainment: ['movie', 'netflix', 'spotify', 'game', 'concert', 'theater', 'gym'],
      healthcare: ['doctor', 'hospital', 'pharmacy', 'medical', 'dentist', 'clinic']
    };
  }

  categorizeTransaction(description, amount) {
    const desc = description.toLowerCase();
    
    // Rule-based categorization
    for (const [category, keywords] of Object.entries(this.keywordMap)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }

    // Amount-based rules
    if (amount > 1000) return 'bills';
    if (amount < 10) return 'food';
    
    return 'others';
  }

  async getSpendingInsights(transactions) {
    // Local analysis without external API
    const categoryTotals = {};
    const monthlySpending = {};
    
    transactions.forEach(transaction => {
      const category = transaction.category;
      const month = new Date(transaction.date).getMonth();
      
      categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
      monthlySpending[month] = (monthlySpending[month] || 0) + transaction.amount;
    });

    // Generate insights
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => 
      categoryTotals[a] > categoryTotals[b] ? a : b
    );

    const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const avgMonthly = totalSpent / Object.keys(monthlySpending).length;

    return {
      topSpendingCategory: topCategory,
      totalSpent,
      averageMonthlySpending: avgMonthly,
      insights: [
        `Your highest spending category is ${topCategory} (${((categoryTotals[topCategory] / totalSpent) * 100).toFixed(1)}%)`,
        `Average monthly spending: $${avgMonthly.toFixed(2)}`,
        `Consider setting a budget for ${topCategory} to control spending`
      ]
    };
  }

  suggestBudget(transactions, income) {
    const categoryTotals = {};
    transactions.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const savingsRate = 0.2; // 20% savings goal
    const availableForBudget = income * (1 - savingsRate);

    // Proportional budget based on current spending
    const suggestions = {};
    Object.keys(categoryTotals).forEach(category => {
      const proportion = categoryTotals[category] / totalSpent;
      suggestions[category] = Math.round(availableForBudget * proportion);
    });

    suggestions.savings = Math.round(income * savingsRate);
    return suggestions;
  }
}

export default new LocalAIService();
```

### **Option 2: Ollama (Local LLM)**

#### **Setup Ollama on your development machine:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a lightweight model
ollama pull llama2:7b-chat
# or for even lighter model
ollama pull phi:2.7b
```

#### **Create Ollama Service:**
```javascript
// services/ollamaService.js
class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434'; // Ollama default port
  }

  async categorizeTransaction(description, amount) {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi:2.7b',
          prompt: `Categorize this transaction: "${description}" Amount: $${amount}
          Categories: food, bills, shopping, transport, entertainment, healthcare, others
          Respond with only the category name:`,
          stream: false
        })
      });

      const data = await response.json();
      return data.response.trim().toLowerCase();
    } catch (error) {
      console.error('Ollama categorization failed:', error);
      return 'others';
    }
  }

  async getFinancialAdvice(question, context) {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2:7b-chat',
          prompt: `You are a financial advisor. Context: ${JSON.stringify(context)}
          Question: ${question}
          Provide helpful, practical financial advice:`,
          stream: false
        })
      });

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Ollama advice failed:', error);
      return 'Unable to provide advice at this time.';
    }
  }
}

export default new OllamaService();
```

## 🔄 **n8n Integration (Workflow Automation)**

### **Setup n8n:**
```bash
# Install n8n globally
npm install n8n -g

# Or run with Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n

# Start n8n
n8n start
```

### **Create n8n Service:**
```javascript
// services/n8nService.js
class N8nService {
  constructor() {
    this.n8nURL = 'http://localhost:5678'; // Your n8n instance
    this.webhookURL = `${this.n8nURL}/webhook`; // n8n webhook endpoint
  }

  async categorizeTransaction(description, amount) {
    try {
      const response = await fetch(`${this.webhookURL}/categorize-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      return data.category || 'others';
    } catch (error) {
      console.error('n8n categorization failed:', error);
      return 'others';
    }
  }

  async processFinancialData(transactions, budgets) {
    try {
      const response = await fetch(`${this.webhookURL}/process-financial-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          budgets,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('n8n processing failed:', error);
      return null;
    }
  }

  async sendBudgetAlert(userId, alertData) {
    try {
      await fetch(`${this.webhookURL}/budget-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          alertType: alertData.type,
          message: alertData.message,
          amount: alertData.amount,
          category: alertData.category,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('n8n alert failed:', error);
    }
  }
}

export default new N8nService();
```

### **n8n Workflow Examples:**

#### **1. Transaction Categorization Workflow:**
```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "categorize-transaction",
        "httpMethod": "POST"
      }
    },
    {
      "name": "OpenAI",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "operation": "text",
        "prompt": "Categorize this transaction: {{$json.description}} Amount: ${{$json.amount}}\nCategories: food, bills, shopping, transport, entertainment, healthcare, others\nRespond with only the category name:",
        "maxTokens": 10
      }
    },
    {
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "responseBody": "{\n  \"category\": \"{{$json.choices[0].text}}\",\n  \"confidence\": 0.9\n}"
      }
    }
  ]
}
```

#### **2. Budget Alert Workflow:**
```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "budget-alert"
      }
    },
    {
      "name": "Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "subject": "Budget Alert: {{$json.alertType}}",
        "text": "{{$json.message}}"
      }
    },
    {
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "operation": "postMessage",
        "text": "🚨 Budget Alert: {{$json.message}}"
      }
    }
  ]
}
```

## 🔧 **Implementation in Your App**

### **Add AI Service Selection:**
```javascript
// services/aiManager.js
import LocalAIService from './localAIService';
import OllamaService from './ollamaService';
import N8nService from './n8nService';

class AIManager {
  constructor() {
    this.currentService = 'local'; // 'local', 'ollama', 'n8n'
    this.services = {
      local: LocalAIService,
      ollama: OllamaService,
      n8n: N8nService
    };
  }

  setService(serviceName) {
    if (this.services[serviceName]) {
      this.currentService = serviceName;
    }
  }

  async categorizeTransaction(description, amount) {
    const service = this.services[this.currentService];
    return await service.categorizeTransaction(description, amount);
  }

  async getSpendingInsights(transactions, budgets) {
    const service = this.services[this.currentService];
    return await service.getSpendingInsights(transactions, budgets);
  }
}

export default new AIManager();
```

### **Add AI Settings Screen:**
```javascript
// screens/AISettingsScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import AIManager from '../services/aiManager';

export default function AISettingsScreen() {
  const { theme } = useTheme();
  const [selectedService, setSelectedService] = useState('local');

  const aiOptions = [
    { id: 'local', name: 'Local AI', description: 'Fast, private, works offline' },
    { id: 'ollama', name: 'Ollama', description: 'Local LLM, more accurate' },
    { id: 'n8n', name: 'n8n Workflows', description: 'Automated workflows' }
  ];

  const selectService = (serviceId) => {
    setSelectedService(serviceId);
    AIManager.setService(serviceId);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>AI Service Settings</Text>
      
      {aiOptions.map(option => (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.option,
            { backgroundColor: theme.surface },
            selectedService === option.id && { borderColor: theme.primary, borderWidth: 2 }
          ]}
          onPress={() => selectService(option.id)}
        >
          <Text style={[styles.optionName, { color: theme.text }]}>{option.name}</Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>{option.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  option: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  optionName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  optionDesc: { fontSize: 14 },
});
```

## 📊 **Comparison: Local AI vs n8n**

| Feature | Local AI | Ollama | n8n |
|---------|----------|---------|-----|
| **Privacy** | ✅ Complete | ✅ Complete | ⚠️ Depends on setup |
| **Cost** | ✅ Free | ✅ Free | ✅ Free (self-hosted) |
| **Offline** | ✅ Yes | ✅ Yes | ❌ No |
| **Accuracy** | ⚠️ Basic | ✅ High | ✅ High (with AI nodes) |
| **Setup** | ✅ Easy | ⚠️ Medium | ⚠️ Medium |
| **Automation** | ❌ Limited | ❌ Limited | ✅ Excellent |

## 🚀 **Recommended Approach:**

### **Phase 1: Start with Local AI**
- Quick to implement
- No external dependencies
- Good for basic categorization

### **Phase 2: Add Ollama for Better AI**
- More accurate responses
- Still completely private
- Better for insights and advice

### **Phase 3: Integrate n8n for Automation**
- Automated workflows
- Email/SMS alerts
- Data processing pipelines

## 💡 **Best Practices:**

### **For Local AI:**
- Keep models lightweight for mobile
- Cache results to improve performance
- Fallback to rule-based logic

### **For n8n:**
- Use webhooks for real-time processing
- Set up error handling and retries
- Monitor workflow performance

Would you like me to help you implement any of these approaches? I recommend starting with the **Local AI** option as it's the easiest to set up and provides immediate value!