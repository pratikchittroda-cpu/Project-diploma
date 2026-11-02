import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { remoteProfileImage } from '../../utils/profileImage';
import MessageService from '../../services/MessageService';
import { AccountAvatar, AccountButton, AccountCard, AccountField, AccountRow, AccountScreen, AccountSection, useAccountTask } from './AccountPrimitives';

export default function AccountProfileEditor({ navigation, company = false }) {
  const { user, userData, updateUserProfile, loading } = useAuth();
  const [name, setName] = useState(userData?.fullName || '');
  const [companyName, setCompanyName] = useState(userData?.companyName || '');
  const [contactPerson, setContactPerson] = useState(userData?.contactPerson || userData?.fullName || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [industry, setIndustry] = useState(userData?.industry || '');
  const { busy, run } = useAccountTask();
  const pending = busy || loading;
  const image = (company && remoteProfileImage(userData?.companyLogoUri)) || remoteProfileImage(userData?.profileImageUri) || remoteProfileImage(user?.photoURL);
  const save = () => run(async (stillMounted) => {
    if (!stillMounted()) return;
    if (!name.trim() || (company && (!companyName.trim() || !contactPerson.trim()))) {
      MessageService.showError('Missing details', 'Enter your name and required company details.'); return;
    }
    const result = await updateUserProfile({ fullName: name.trim(), phone: phone.trim(),
      ...(company ? { companyName: companyName.trim(), contactPerson: contactPerson.trim(), industry: industry.trim() } : {}) });
    if (!stillMounted() || result.stale) return;
    if (result.success) MessageService.showSuccess('Profile saved', 'Your profile details were saved.', { onDismiss: () => { if (stillMounted()) navigation.goBack(); } });
    else MessageService.showError('Save failed', result.error);
  });
  const hero = <View style={styles.photoSection}>
    <AccountAvatar uri={image} company={company} photoUnavailable />
    <Text style={styles.photoTitle}>{company ? 'Company Logo' : 'Profile Photo'}</Text>
    <Text style={styles.photoSubtitle}>Your existing photo is display-only in this build.</Text>
  </View>;
  return <AccountScreen title={company ? 'Edit Company Profile' : 'Edit Profile'} navigation={navigation} hero={hero}>
    <AccountRow title={company ? 'Change Company Logo' : 'Change Profile Photo'} icon="camera-outline" disabled value="Unavailable"
      subtitle="Photo uploads require a configured upload service. This build does not upload or save local photo links." />
    <AccountCard>
      {company && <AccountSection title="Company Information">
        <AccountField label="Company name" icon="office-building-outline" placeholder="Enter company name" value={companyName}
          onChangeText={setCompanyName} maxLength={160} autoCapitalize="words" editable={!pending} />
        <AccountField label="Industry (optional)" icon="domain" placeholder="Enter your industry" value={industry}
          onChangeText={setIndustry} maxLength={120} autoCapitalize="words" editable={!pending} />
      </AccountSection>}
      <AccountSection title={company ? 'Contact Information' : 'Personal Information'}>
        <AccountField label="Full name" icon="account-outline" placeholder="Enter your full name" value={name} onChangeText={setName}
          maxLength={120} autoCapitalize="words" autoComplete="name" editable={!pending} />
        {company && <AccountField label="Contact person" icon="account-tie-outline" placeholder="Enter contact person" value={contactPerson}
          onChangeText={setContactPerson} maxLength={120} autoCapitalize="words" editable={!pending} />}
        <AccountField label="Email" icon="email-outline" value={user?.email || ''} autoCapitalize="none" editable={false}
          helperText="Your sign-in email cannot be changed here." />
        <AccountField label="Phone (optional)" icon="phone-outline" placeholder="Enter phone number" value={phone} onChangeText={setPhone}
          keyboardType="phone-pad" autoComplete="tel" maxLength={40} editable={!pending} />
      </AccountSection>
      <AccountButton title={busy ? 'Saving profile…' : 'Save Changes'} icon="content-save-outline" onPress={save} busy={busy} disabled={loading} />
      <AccountButton title="Cancel" secondary disabled={pending} onPress={() => navigation.goBack()} />
    </AccountCard>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  photoSection: { alignItems: 'center', paddingTop: 6, paddingBottom: 24 },
  photoTitle: { fontSize: 18, lineHeight: 26, color: '#fff', fontWeight: '600', textAlign: 'center', marginBottom: 5 },
  photoSubtitle: { fontSize: 14, lineHeight: 21, color: '#fff', textAlign: 'center', maxWidth: 320 },
});
