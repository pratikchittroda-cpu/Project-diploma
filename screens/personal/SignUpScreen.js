import React from 'react';
import AccountAuthForm from '../../components/account/AccountAuthForm';
export default function SignUpScreen({ navigation }) {
  return <AccountAuthForm navigation={navigation} accountType="personal" registering />;
}
