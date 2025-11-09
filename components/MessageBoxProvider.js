import React, { useRef } from 'react';
import ThemedMessageBox from './ThemedMessageBox';
import { useThemedMessageBox } from '../hooks/useThemedMessageBox';
import MessageService from '../services/MessageService';

const MessageBoxProvider = ({ children }) => {
  const messageBoxHook = useThemedMessageBox();
  const messageBoxRef = useRef(null);

  // Set the reference for the global message service
  React.useEffect(() => {
    messageBoxRef.current = messageBoxHook;
    MessageService.setMessageBoxRef(messageBoxHook);
  }, [messageBoxHook]);

  return (
    <>
      {children}
      <ThemedMessageBox
        {...messageBoxHook.messageBoxConfig}
        onDismiss={messageBoxHook.hideMessage}
      />
    </>
  );
};

export default MessageBoxProvider;