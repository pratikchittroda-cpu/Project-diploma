import React from 'react';
import AccountAuthForm from '../../components/account/AccountAuthForm';
export default function CompanyLoginScreen({ navigation }) {
  return <AccountAuthForm navigation={navigation} accountType="company" />;
}
