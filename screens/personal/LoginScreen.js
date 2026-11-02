import React from 'react';
import AccountAuthForm from '../../components/account/AccountAuthForm';
export default function LoginScreen({ navigation }) {
  return <AccountAuthForm navigation={navigation} accountType="personal" />;
}
