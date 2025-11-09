import { useState, useEffect, useCallback } from 'react';
import transactionService from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

export const useTransactions = (pageSize = 20) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [error, setError] = useState(null);

  const loadTransactions = useCallback(async (refresh = false) => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (refresh) {
      setRefreshing(true);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await transactionService.getUserTransactions(
        user.uid, 
        pageSize, 
        refresh ? null : lastDoc
      );

      if (result.success) {
        // Sort transactions by date (newest first) as a fallback
        const sortedTransactions = result.transactions.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date);
          const dateB = new Date(b.createdAt || b.date);
          return dateB - dateA;
        });

        if (refresh) {
          setTransactions(sortedTransactions);
        } else {
          const combinedTransactions = [...transactions, ...sortedTransactions];
          // Sort the combined array to maintain order
          const sortedCombined = combinedTransactions.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date);
            const dateB = new Date(b.createdAt || b.date);
            return dateB - dateA;
          });
          setTransactions(sortedCombined);
        }
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, pageSize, lastDoc]);

  const addTransaction = useCallback(async (transactionData) => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      const result = await transactionService.addTransaction(user.uid, transactionData);
      if (result.success) {
        // Refresh transactions to include the new one
        await loadTransactions(true);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [user, loadTransactions]);

  const updateTransaction = useCallback(async (transactionId, updateData) => {
    try {
      const result = await transactionService.updateTransaction(transactionId, updateData);
      if (result.success) {
        // Update local state
        setTransactions(prev => 
          prev.map(transaction => 
            transaction.id === transactionId 
              ? { ...transaction, ...updateData }
              : transaction
          )
        );
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const deleteTransaction = useCallback(async (transactionId) => {
    try {
      const result = await transactionService.deleteTransaction(transactionId);
      if (result.success) {
        // Remove from local state
        setTransactions(prev => 
          prev.filter(transaction => transaction.id !== transactionId)
        );
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadTransactions(false);
    }
  }, [loading, hasMore, loadTransactions]);

  const refresh = useCallback(() => {
    loadTransactions(true);
  }, [loadTransactions]);

  const getTransactionStats = useCallback(async () => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const result = await transactionService.getTransactionStats(user.uid, startDate, endDate);
      
      if (result.success) {
        return {
          success: true,
          data: {
            totalBalance: result.stats.netAmount,
            monthlyIncome: result.stats.totalIncome,
            monthlyExpenses: result.stats.totalExpenses,
            budgetUsed: 0, // This would come from budget service
            budgetLimit: 0, // This would come from budget service
          }
        };
      }
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTransactions(true);
    }
  }, [user]);

  return {
    transactions,
    loading,
    refreshing,
    hasMore,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loadMore,
    refresh,
    getTransactionStats
  };
};

export const useTransactionStats = (startDate, endDate) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    if (!user || !startDate || !endDate) return;

    setLoading(true);
    try {
      const result = await transactionService.getTransactionStats(
        user.uid, 
        startDate, 
        endDate
      );

      if (result.success) {
        setStats(result.stats);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats
  };
};