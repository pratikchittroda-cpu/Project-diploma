'use strict';
const config = require('./public-config.js');
const approvedAccessRecipient = 'pratikchittroda@gmail.com';
const approvedAccessEndpoint = `https://formsubmit.co/ajax/${approvedAccessRecipient}`;
function validate(config) {
  const errors = [];
  for (const key of ['publisherName', 'supportEmail', 'providerRetention', 'operationalLogRetention', 'deletionRequestTimescale', 'policyEffectiveDate']) {
    if (typeof config[key] !== 'string' || !config[key].trim() || /TODO|NOT CONFIGURED|example\.(com|org)|placeholder/i.test(config[key])) errors.push(`${key} must contain verified publishing information`);
  }
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(config.supportEmail || '')) errors.push('supportEmail must be a real monitored contact');
  for (const key of ['privacyPolicyUrl', 'accountDeletionUrl']) {
    try {
      const url = new URL(config[key]);
      if (url.protocol !== 'https:' || url.username || url.password || /localhost|example\.(com|org)|127\.0\.0\.1/.test(url.hostname)) throw new Error();
    } catch { errors.push(`${key} must be a real public HTTPS URL`); }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.policyEffectiveDate || '')) errors.push('policyEffectiveDate must be YYYY-MM-DD');
  if (config.accessRequestRecipient !== approvedAccessRecipient || config.accessRequestRecipient !== config.supportEmail) {
    errors.push('accessRequestRecipient must be the approved publisher email and match supportEmail');
  }
  try {
    const url = new URL(config.accessRequestEndpoint);
    // Exact spelling also rejects an explicit :443 port, encoded paths and URL normalization tricks.
    if (config.accessRequestEndpoint !== approvedAccessEndpoint || url.protocol !== 'https:' || url.hostname !== 'formsubmit.co' || url.port || url.username || url.password || url.search || url.hash || url.pathname !== `/ajax/${approvedAccessRecipient}`) throw new Error();
  } catch { errors.push('accessRequestEndpoint must be the exact approved public FormSubmit HTTPS AJAX recipient URL'); }
  return errors;
}
if (require.main === module) {
  const errors = validate(config);
  if (errors.length) { console.error(`Publishing blocked:\n${errors.map(error => `- ${error}`).join('\n')}`); process.exitCode = 1; }
  else console.log('Public legal and access-request configuration is present. Verify published URLs, the monitored deletion-request flow and publisher FormSubmit activation before release.');
}
module.exports = { validate };
