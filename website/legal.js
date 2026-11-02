'use strict';
const config = window.EXPENZO_PUBLIC_CONFIG || {};
const emailValid = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(config.supportEmail || '');
const fields = ['publisherName', 'supportEmail', 'privacyPolicyUrl', 'accountDeletionUrl', 'providerRetention', 'operationalLogRetention', 'deletionRequestTimescale', 'policyEffectiveDate'];
const configured = fields.every(key => typeof config[key] === 'string' && config[key].trim()) && emailValid;
document.querySelectorAll('[data-config]').forEach(node => {
  const value = config[node.dataset.config];
  if (typeof value === 'string' && value.trim()) node.textContent = value;
});
document.querySelectorAll('[data-config-warning]').forEach(node => { node.hidden = configured; });
if (emailValid) document.querySelectorAll('[data-contact]').forEach(node => { node.href = `mailto:${config.supportEmail}?subject=Expenzo%20privacy%20request`; });
const form = document.getElementById('deletion-request');
if (form) {
  const button = document.getElementById('prepare-request'), status = document.getElementById('request-status');
  button.disabled = !configured;
  if (configured) status.textContent = 'Prepare the email, then review and send it from your registered address.';
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!configured || !form.reportValidity()) return;
    const email = document.getElementById('account-email').value.trim();
    const type = document.getElementById('account-type').value;
    const body = `I request deletion of my Expenzo account and associated data.\nRegistered email: ${email}\nAccount type: ${type}\nPlease explain the ownership verification steps and confirm completion.\nI have not included passwords, sign-in codes or financial records.`;
    window.location.href = `mailto:${config.supportEmail}?subject=${encodeURIComponent('Expenzo account deletion')}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Email prepared. Review and send it in your email app. This website has not submitted or completed your request.';
  });
}
