import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function EditProfileScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user, userData, updateUserProfile } = useAuth();
  const [fullName, setFullName] = useState(userData?.fullName || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.primary || '#667eea' }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Update form fields when userData changes (auto-refresh)
    setFullName(userData?.fullName || '');
    setPhone(userData?.phone || '');
  }, [userData]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    setIsSubmitting(true);

    try {
      const profileData = {
        fullName: fullName.trim(),
        phone: phone.trim(),
      };

      // Use the real updateUserProfile function from AuthContext
      const result = await updateUserProfile(profileData);

      if (result.success) {
        Alert.alert(
          'Success!',
          'Your profile has been updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background Gradient */}
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Image Section */}
          <Animated.View style={[styles.profileSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImage}>
                <Icon name="account" size={60} color="white" />
              </View>
              <TouchableOpacity style={styles.editImageButton}>
                <Icon name="camera" size={16} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Icon name="account-outline" size={20} color="white" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Input (Disabled) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={[styles.inputContainer, styles.disabledInput]}>
                <Icon name="email-outline" size={20} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, styles.disabledText]}
                  value={user?.email || ''}
                  editable={false}
                  placeholder="Email cannot be changed"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
              <Text style={styles.helperText}>Email address cannot be changed</Text>
            </View>

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Icon name="phone-outline" size={20} color="white" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your phone number"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </Animated.View>

          {/* Buttons Section */}
          <Animated.View style={[styles.buttonSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.disabledButton]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon name="content-save" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  changePhotoText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    opacity: 0.8,
  },
  formSection: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  disabledInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: 'white',
  },
  disabledText: {
    color: 'rgba(255,255,255,0.5)',
  },
  helperText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 5,
    marginLeft: 5,
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  cancelButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
});