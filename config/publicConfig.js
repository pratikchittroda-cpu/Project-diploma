import {
    AI_API_BASE_URL as aiApiBaseUrl,
    API_BASE_URL as apiBaseUrl,
    PRIVACY_POLICY_URL as privacyPolicyUrl,
    ACCOUNT_DELETION_URL as accountDeletionUrl,
    SUPPORT_EMAIL as supportEmail,
} from '@env';

// These values are public and compiled into the app. Never put secrets here.
export const AI_API_BASE_URL = (aiApiBaseUrl || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = (apiBaseUrl || '').trim().replace(/\/+$/, '');
export const PRIVACY_POLICY_URL = (privacyPolicyUrl || '').trim();
export const ACCOUNT_DELETION_URL = (accountDeletionUrl || '').trim();
export const SUPPORT_EMAIL = (supportEmail || '').trim();
