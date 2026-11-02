import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config/publicConfig';
import { SERVER_FEATURES_ENABLED } from '../../config/releaseFeatures';
import MessageService from '../../services/MessageService';

export function useAccountActions() {
  const { user, signOut, deleteAccount, reauthenticate } = useAuth();
  const deletionAvailable = SERVER_FEATURES_ENABLED && !!API_BASE_URL;
  const handleResult = (result, title) => {
    if (result.cleanupWarning) MessageService.showWarning('Local cleanup incomplete', result.cleanupWarning);
    else if (result.success) MessageService.showSuccess(title, title === 'Account deleted' ? 'The server confirmed deletion of your account and app data.' : 'You have been signed out.');
    else MessageService.showError('Action failed', result.error || 'Please try again.');
  };
  const requestSignOut = () => MessageService.showConfirm('Sign out?', 'You will need to sign in to access your account again.',
    async () => handleResult(await signOut(), 'Signed out'));
  const performDeletion = async (reauthenticated = false) => {
    const result = await deleteAccount();
    if (result.requiresRecentLogin && !reauthenticated) {
      const verify = async (password) => {
        const verified = await reauthenticate(password);
        if (verified.success) await performDeletion(true);
        else if (!verified.canceled) MessageService.showError('Verification failed', verified.error);
      };
      if (user?.providerData?.some((provider) => provider.providerId === 'password')) {
        MessageService.showPrompt('Verify your identity', 'Enter your current password to continue deleting this account.', verify,
          undefined, { secureTextEntry: true, placeholder: 'Current password', confirmButtonText: 'Verify & delete' });
      } else {
        MessageService.showConfirm('Verify your identity', 'Sign in with Google again to continue deleting this account.', () => verify(),
          undefined, { confirmButtonText: 'Verify & delete' });
      }
    } else handleResult(result, 'Account deleted');
  };
  const requestDelete = () => {
    if (!deletionAvailable) return;
    MessageService.showPrompt('Delete account', 'This permanently deletes your account and its app data. Type delete to confirm. If a connection fails, retry to resume the server deletion.',
      async (value) => {
        if (value?.trim().toLowerCase() !== 'delete') { MessageService.showError('Not deleted', 'Type delete to confirm.'); return; }
        await performDeletion();
      }, undefined, { placeholder: 'Type delete', confirmButtonText: 'Delete', confirmButtonColor: '#B42318' });
  };
  return { requestSignOut, requestDelete, deletionAvailable };
}
