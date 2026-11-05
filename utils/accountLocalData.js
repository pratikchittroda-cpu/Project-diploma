import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const legacyKeys = ['recentActions', 'personal_recent_actions', 'company_recent_actions',
  'company_notifications_enabled', 'company_email_reports_enabled'];

// Only app-owned account data; never clear Firebase's persistence or other apps' settings.
export const clearAccountLocalData = async (uid) => {
  const failures = [];
  try {
    const keys = await AsyncStorage.getAllKeys();
    const owned = keys.filter((key) => legacyKeys.includes(key) || (uid && (
      key.startsWith(`account:${uid}:`) || key === `ai-consent:${uid}` ||
      // Remembered AI sharing consent (chat and transaction tools), one key per account.
      (/^(aiConsent|aiToolsConsent):v[0-9]+:/.test(key) && key.replace(/^(aiConsent|aiToolsConsent):v[0-9]+:/, '') === uid)
    )));
    if (owned.length) await AsyncStorage.multiRemove(owned);
  } catch (_) { failures.push('preferences'); }
  for (const directory of [FileSystem.documentDirectory && `${FileSystem.documentDirectory}profile-images/`,
    FileSystem.cacheDirectory && `${FileSystem.cacheDirectory}ImageManipulator/`,
    FileSystem.cacheDirectory && `${FileSystem.cacheDirectory}ImagePicker/`].filter(Boolean)) {
    try { await FileSystem.deleteAsync(directory, { idempotent: true }); }
    catch (_) { failures.push('temporary images'); }
  }
  return failures.length ? { success: false, error: 'Signed out, but some local preferences or temporary pictures could not be removed. Clear app storage on this device to remove them.' } : { success: true };
};
