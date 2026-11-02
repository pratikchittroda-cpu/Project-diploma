import React from 'react';
import { FinanceAccount } from '../../components/finance/FinanceUI';
import PersonalDashboard from '../../components/finance/PersonalDashboard';

export default function DashboardScreen(props) { return <FinanceAccount component={PersonalDashboard} {...props} />; }
