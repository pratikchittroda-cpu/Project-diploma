import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const PROFILE_IMAGE_DIR = `${FileSystem.documentDirectory}profile-images/`;

export const pickEditableProfileImage = async (userId) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return {
      success: false,
      error: 'Photo library permission is required to update your profile picture.',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) {
    return { success: false, canceled: true };
  }

  const selectedAsset = result.assets[0];
  const processedImage = await ImageManipulator.manipulateAsync(
    selectedAsset.uri,
    [{ resize: { width: 512 } }],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  const dirInfo = await FileSystem.getInfoAsync(PROFILE_IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PROFILE_IMAGE_DIR, { intermediates: true });
  }

  const fileUri = `${PROFILE_IMAGE_DIR}${userId || 'profile'}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({
    from: processedImage.uri,
    to: fileUri,
  });

  return {
    success: true,
    uri: fileUri,
  };
};
