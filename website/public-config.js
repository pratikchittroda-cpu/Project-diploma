// PUBLIC publishing configuration. Supply real, verified details before release.
// Never put API keys, service credentials or passwords in this file.
const PUBLIC_CONFIG = Object.freeze({
  publisherName: 'Expenzo',
  supportEmail: 'pratikchittroda@gmail.com',
  // Public FormSubmit routing, not a credential. The publisher replies manually.
  accessRequestRecipient: 'pratikchittroda@gmail.com',
  accessRequestEndpoint: 'https://formsubmit.co/ajax/pratikchittroda@gmail.com',
  privacyPolicyUrl: 'https://project1-7a465.web.app/privacy.html',
  accountDeletionUrl: 'https://project1-7a465.web.app/account-deletion.html',
  providerRetention: 'AI-enabled builds send consented requests to NVIDIA through Expo EAS Hosting. Provider processing and retention are governed by NVIDIA and Expo policies; Expenzo does not promise a provider deletion deadline.',
  operationalLogRetention: 'The app and AI API do not intentionally log financial content or credentials. Firebase, Expo and NVIDIA infrastructure logs follow their respective policies; daily request counters remain until the publisher removes them.',
  deletionRequestTimescale: 'Data is kept until you delete records or the publisher processes your verified account-deletion request. Requests are handled manually; no response or completion deadline is guaranteed for this small-group release.',
  policyEffectiveDate: '2026-10-25',
});
if (typeof module !== 'undefined') module.exports = PUBLIC_CONFIG;
if (typeof window !== 'undefined') window.EXPENZO_PUBLIC_CONFIG = PUBLIC_CONFIG;
