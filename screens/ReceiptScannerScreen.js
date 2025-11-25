import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StatusBar,
    SafeAreaView,
    Platform,
    Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import ocrService from '../services/ocrService';

export default function ReceiptScannerScreen({ navigation }) {
    const { theme } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedImage, setCapturedImage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [flashMode, setFlashMode] = useState('off');
    const cameraRef = useRef(null);

    useEffect(() => {
        // Request camera permission on mount
        if (!permission?.granted) {
            requestPermission();
        }
    }, []);

    const handleCapture = async () => {
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
            });

            setCapturedImage(photo.uri);
        } catch (error) {
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

    const handlePickFromGallery = async () => {
        try {
            const permissionResult = await requestMediaPermission();

            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'We need access to your photos to select a receipt.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setCapturedImage(result.assets[0].uri);
            }
        } catch (error) {
            console.log('Gallery Error:', error);
            Alert.alert('Error', 'Failed to pick image: ' + error.message);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
    };

    const handleUsePhoto = async () => {
        if (!capturedImage) return;

        setIsProcessing(true);

        try {
            const result = await ocrService.scanReceipt(capturedImage);

            if (result.success && result.data.items && result.data.items.length > 0) {
                // Navigate to Review screen
                navigation.navigate('ReceiptReview', {
                    items: result.data.items,
                    merchant: result.data.merchant,
                    date: result.data.date,
                    receiptImage: capturedImage,
                });
            } else if (result.success && (!result.data.items || result.data.items.length === 0)) {
                Alert.alert(
                    'No Items Detected',
                    'Could not detect individual items. Would you like to enter manually?',
                    [
                        { text: 'Retry', onPress: handleRetake },
                        {
                            text: 'Enter Manually',
                            onPress: () => navigation.navigate('Dashboard', { screen: 'AddTransaction' })
                        },
                    ]
                );
            } else {
                Alert.alert(
                    'Scan Failed',
                    result.error || 'Could not extract data. Please try again.',
                    [
                        { text: 'Retry', onPress: handleRetake },
                        {
                            text: 'Enter Manually',
                            onPress: () => navigation.navigate('Dashboard', { screen: 'AddTransaction' })
                        },
                    ]
                );
            }
        } catch (error) {
            Alert.alert(
                'Error',
                'Failed to process receipt. Check your internet connection.',
                [
                    { text: 'Retry', onPress: handleRetake },
                    { text: 'Cancel', onPress: () => navigation.goBack() },
                ]
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleFlash = () => {
        setFlashMode(current => current === 'off' ? 'on' : 'off');
    };

    const styles = createStyles(theme);

    // Permission not granted
    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[theme.primary, theme.primaryLight]}
                    style={styles.background}
                />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.permissionContainer}>
                        <Icon name="camera-off" size={64} color="white" />
                        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                        <Text style={styles.permissionText}>
                            We need access to your camera to scan receipts
                        </Text>
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // Show captured image preview
    if (capturedImage) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
                <LinearGradient
                    colors={[theme.primary, theme.primaryLight]}
                    style={styles.background}
                />

                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Icon name="close" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Receipt Preview</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    {/* Image Preview */}
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
                    </View>

                    {/* Processing Overlay */}
                    {isProcessing && (
                        <View style={styles.processingOverlay}>
                            <View style={styles.processingCard}>
                                <ActivityIndicator size="large" color="white" />
                                <Text style={styles.processingText}>Scanning receipt...</Text>
                                <Text style={styles.processingSubtext}>Extracting items</Text>
                            </View>
                        </View>
                    )}

                    {/* Action Buttons */}
                    {!isProcessing && (
                        <View style={styles.previewActions}>
                            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                                <Icon name="camera-retake" size={24} color="white" />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.useButton} onPress={handleUsePhoto}>
                                <Icon name="check" size={24} color="white" />
                                <Text style={styles.useButtonText}>Use Photo</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
            </View>
        );
    }

    // Camera view
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                flash={flashMode}
            />

            <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Icon name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan Receipt</Text>
                    <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
                        <Icon
                            name={flashMode === 'on' ? 'flash' : 'flash-off'}
                            size={24}
                            color="white"
                        />
                    </TouchableOpacity>
                </View>

                {/* Focus Frame */}
                <View style={styles.focusFrame}>
                    <View style={styles.frameCorner} />
                    <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
                    <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
                    <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsText}>
                        Position the receipt within the frame
                    </Text>
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity style={styles.galleryButton} onPress={handlePickFromGallery}>
                        <Icon name="image" size={28} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
                        <View style={styles.captureButtonInner} />
                    </TouchableOpacity>

                    <View style={styles.controlsSpacer} />
                </View>
            </SafeAreaView>
        </View>
    );
}

const createStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
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
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    camera: {
        flex: 1,
    },

    // Header
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    flashButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSpacer: {
        width: 40,
    },

    // Focus Frame
    focusFrame: {
        position: 'absolute',
        top: '25%',
        left: '10%',
        right: '10%',
        height: '40%',
    },
    frameCorner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderColor: 'white',
        top: 0,
        left: 0,
    },
    frameCornerTopRight: {
        borderTopWidth: 3,
        borderLeftWidth: 0,
        borderRightWidth: 3,
        left: undefined,
        right: 0,
    },
    frameCornerBottomLeft: {
        borderTopWidth: 0,
        borderBottomWidth: 3,
        top: undefined,
        bottom: 0,
    },
    frameCornerBottomRight: {
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 3,
        borderBottomWidth: 3,
        top: undefined,
        left: undefined,
        right: 0,
        bottom: 0,
    },

    // Instructions
    instructionsContainer: {
        position: 'absolute',
        bottom: 150,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    instructionsText: {
        fontSize: 16,
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },

    // Controls
    controls: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    galleryButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
    },
    controlsSpacer: {
        width: 50,
    },

    // Preview
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    previewActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 40,
        paddingBottom: 40,
        gap: 20,
    },
    retakeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        gap: 8,
    },
    retakeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    useButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 12,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        gap: 8,
    },
    useButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },

    // Processing
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    processingText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 15,
    },
    processingSubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 5,
    },

    // Permission
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 20,
        marginBottom: 10,
    },
    permissionText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 30,
    },
    permissionButton: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 15,
        paddingHorizontal: 40,
        marginBottom: 15,
    },
    permissionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.primary,
    },
    cancelButton: {
        paddingVertical: 15,
    },
    cancelButtonText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
});
