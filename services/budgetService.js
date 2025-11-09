import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

class BudgetService {
  // Create a new budget
  async createBudget(userId, budgetData) {
    try {
      const docRef = await addDoc(collection(db, 'budgets'), {
        userId,
        ...budgetData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return { success: true, budgetId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get user budgets
  async getUserBudgets(userId) {
    try {
      // Temporary fix: Remove orderBy to avoid index requirement
      // TODO: Add back orderBy('createdAt', 'desc') after creating Firestore index
      const q = query(
        collection(db, 'budgets'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const budgets = [];

      querySnapshot.forEach((doc) => {
        budgets.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, budgets };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get budget by category
  async getBudgetByCategory(userId, category) {
    try {
      const q = query(
        collection(db, 'budgets'),
        where('userId', '==', userId),
        where('category', '==', category)
      );

      const querySnapshot = await getDocs(q);
      let budget = null;

      querySnapshot.forEach((doc) => {
        budget = {
          id: doc.id,
          ...doc.data()
        };
      });

      return { success: true, budget };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update budget
  async updateBudget(budgetId, updateData) {
    try {
      await updateDoc(doc(db, 'budgets', budgetId), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Delete budget
  async deleteBudget(budgetId) {
    try {
      await deleteDoc(doc(db, 'budgets', budgetId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get single budget
  async getBudget(budgetId) {
    try {
      const docRef = doc(db, 'budgets', budgetId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          success: true,
          budget: {
            id: docSnap.id,
            ...docSnap.data()
          }
        };
      } else {
        return { success: false, error: 'Budget not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get budget summary with spending
  async getBudgetSummary(userId, month, year) {
    try {
      // Get budgets
      const budgetsResult = await this.getUserBudgets(userId);
      if (!budgetsResult.success) {
        return budgetsResult;
      }

      // Get transactions for the month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('type', '==', 'expense'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);
      const spending = {};

      transactionsSnapshot.forEach((doc) => {
        const transaction = doc.data();
        const category = transaction.category;
        const amount = parseFloat(transaction.amount);

        if (!spending[category]) {
          spending[category] = 0;
        }
        spending[category] += amount;
      });

      // Combine budgets with spending
      const budgetSummary = budgetsResult.budgets.map(budget => ({
        ...budget,
        spent: spending[budget.category] || 0,
        remaining: budget.amount - (spending[budget.category] || 0),
        percentage: ((spending[budget.category] || 0) / budget.amount) * 100
      }));

      return { success: true, budgetSummary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new BudgetService();