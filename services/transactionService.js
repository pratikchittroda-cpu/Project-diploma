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
  limit,
  startAfter,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

class TransactionService {
  // Add a new transaction
  async addTransaction(userId, transactionData) {
    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        userId,
        ...transactionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return { success: true, transactionId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get user transactions with pagination
  async getUserTransactions(userId, pageSize = 20, lastDoc = null) {
    try {
      // Order by createdAt descending to show latest transactions first
      let q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      const transactions = [];
      let lastDocument = null;

      querySnapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
        lastDocument = doc;
      });

      return { 
        success: true, 
        transactions, 
        lastDoc: lastDocument,
        hasMore: transactions.length === pageSize
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get transactions by category
  async getTransactionsByCategory(userId, category) {
    try {
      // Temporary fix: Remove orderBy to avoid index requirement
      // TODO: Add back orderBy('createdAt', 'desc') after creating Firestore index
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('category', '==', category)
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, transactions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get transactions by date range
  async getTransactionsByDateRange(userId, startDate, endDate) {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, transactions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update transaction
  async updateTransaction(transactionId, updateData) {
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Delete transaction
  async deleteTransaction(transactionId) {
    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get transaction statistics
  async getTransactionStats(userId, startDate, endDate) {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );

      const querySnapshot = await getDocs(q);
      let totalIncome = 0;
      let totalExpenses = 0;
      const categoryBreakdown = {};

      querySnapshot.forEach((doc) => {
        const transaction = doc.data();
        const amount = parseFloat(transaction.amount);

        if (transaction.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpenses += amount;
        }

        // Category breakdown
        if (!categoryBreakdown[transaction.category]) {
          categoryBreakdown[transaction.category] = {
            name: transaction.category,
            amount: 0,
            count: 0,
            type: transaction.type
          };
        }
        categoryBreakdown[transaction.category].amount += amount;
        categoryBreakdown[transaction.category].count += 1;
      });

      const netAmount = totalIncome - totalExpenses;

      return {
        success: true,
        stats: {
          totalIncome,
          totalExpenses,
          netAmount,
          categoryBreakdown: Object.values(categoryBreakdown)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get single transaction
  async getTransaction(transactionId) {
    try {
      const docRef = doc(db, 'transactions', transactionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          success: true,
          transaction: {
            id: docSnap.id,
            ...docSnap.data()
          }
        };
      } else {
        return { success: false, error: 'Transaction not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new TransactionService();