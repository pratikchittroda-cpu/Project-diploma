import React, { useEffect } from 'react';
import ThemedMessageBox from './ThemedMessageBox';
import { useThemedMessageBox } from '../hooks/useThemedMessageBox';
import MessageService from '../services/MessageService';
import { useAuth } from '../contexts/AuthContext';

export default function MessageBoxProvider({ children }) {
  const messages = useThemedMessageBox();
  const { user } = useAuth();
  useEffect(() => {
    MessageService.setMessageBoxRef(messages);
    return () => MessageService.setMessageBoxRef(null);
  }, [messages]);
  useEffect(() => { messages.clear(); }, [user?.uid]);
  return <>{children}<ThemedMessageBox key={messages.messageBoxConfig.id || 'empty'} {...messages.messageBoxConfig} /></>;
}
