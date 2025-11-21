import { useState, useEffect, useCallback } from 'react';
import budgetService from '../services/budgetService';
import { useAuth } from '../contexts/AuthContext';

export const useBudgets = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBudgets = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await budgetService.getUserBudgets(user.uid);

      if (result.success) {
        setBudgets(result.budgets);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createBudget = useCallback(async (budgetData) => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      const result = await budgetService.createBudget(user.uid, budgetData);
      if (result.success) {
        // Refresh budgets to include the new one
        await loadBudgets();
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [user, loadBudgets]);

  const updateBudget = useCallback(async (budgetId, updateData) => {
    try {
      const result = await budgetService.updateBudget(budgetId, updateData);
      if (result.success) {
        // Update local state
        setBudgets(prev => 
          prev.map(budget => 
            budget.id === budgetId 
              ? { ...budget, ...updateData }
              : budget
          )
        );
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const deleteBudget = useCallback(async (budgetId) => {
    try {
      const result = await budgetService.deleteBudget(budgetId);
      if (result.success) {
        // Remove from local state
        setBudgets(prev => 
          prev.filter(budget => budget.id !== budgetId)
        );
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadBudgets();
    }
  }, [user, loadBudgets]);

  return {
    budgets,
    loading,
    error,
    createBudget,
    updateBudget,
    deleteBudget,
    refresh: loadBudgets
  };
};

export const useBudgetSummary = (month, year) => {
  const { user } = useAuth();
  const [budgetSummary, setBudgetSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBudgetSummary = useCallback(async () => {
    if (!user || !month || !year) return;

    setLoading(true);
    try {
      const result = await budgetService.getBudgetSummary(user.uid, month, year);

      if (result.success) {
        setBudgetSummary(result.budgetSummary);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, month, year]);

  useEffect(() => {
    loadBudgetSummary();
  }, [loadBudgetSummary]);

  return {
    budgetSummary,
    loading,
    error,
    refresh: loadBudgetSummary
  };
};