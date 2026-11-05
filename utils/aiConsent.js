import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AI sharing consent is asked once per account and remembered on this device until the user
// revokes it. Chat and the transaction tools share different data, so each keeps its own choice.
// Both key patterns are removed by clearAccountLocalData on sign-out, account switch and deletion.
export const chatConsentKey = uid => `aiConsent:v3:${uid}`;
export const toolsConsentKey = uid => `aiToolsConsent:v1:${uid}`;
const GRANTED = 'granted';

function createConsentStore(keyFor) {
  const listeners = new Set();

  async function load(uid) {
    if (!uid) return false;
    try {
      return (await AsyncStorage.getItem(keyFor(uid))) === GRANTED;
    } catch {
      return false; // Unreadable storage means asking again, never assuming consent.
    }
  }

  // Saves (or clears) the choice and tells open screens right away. Resolves false if the
  // device could not store it, so callers can say so instead of silently diverging later.
  async function save(uid, granted) {
    if (!uid) return false;
    listeners.forEach(listener => listener(uid, granted));
    try {
      if (granted) await AsyncStorage.setItem(keyFor(uid), GRANTED);
      else await AsyncStorage.removeItem(keyFor(uid));
      return true;
    } catch {
      return false;
    }
  }

  // Current remembered consent for an account, kept in sync with changes made elsewhere.
  function useStored(uid) {
    const [granted, setGranted] = useState(false);
    useEffect(() => {
      let active = true;
      setGranted(false);
      load(uid).then(value => { if (active) setGranted(value); });
      const listener = (changedUid, value) => { if (active && changedUid === uid) setGranted(value); };
      listeners.add(listener);
      return () => { active = false; listeners.delete(listener); };
    }, [uid]);
    return granted;
  }

  return { load, save, useStored };
}

const chat = createConsentStore(chatConsentKey);
const tools = createConsentStore(toolsConsentKey);

export const loadChatConsent = chat.load;
export const saveChatConsent = chat.save;
export const useStoredChatConsent = chat.useStored;
export const loadToolsConsent = tools.load;
export const saveToolsConsent = tools.save;
