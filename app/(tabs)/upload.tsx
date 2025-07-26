// REQUIRED: Ensure supabase client is initialized at @/lib/supabase
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatTimeAgo(date: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

type UploadType = 'swing' | 'pitch';

interface UploadHistoryItem {
  type: UploadType;
  score: number;
  date: Date;
}

export default function UploadScreen() {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);

  // Convert local file URI to blob for upload
  async function uriToBlob(uri: string): Promise<Blob> {
    const res = await fetch(uri);
    //console.log("Fetch status:", res.status);
    const blob = await res.blob();
    /* console.log("Uploading from URI:", uri);
    console.log("BLOB DEBUG =======");
    console.log("Type:", blob.type);
    console.log("Size (bytes):", blob.size); */
    return blob;
  }

  // Upload video to Supabase Storage bucket
  async function uploadVideoToSupabase(fileUri: string, type: UploadType): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const timestamp = Date.now();
      const extension = '.mp4'; // or 'mp4' depending on the video format
      const filePath = `${type}-${timestamp}.${extension}`;
      const contentType = 'video/mp4'; // Or 'video/mp4' if appropriate

      const { data, error } = await supabase.storage
        .from('mechanics-uploads-bucket')
        .upload(filePath, decode(base64), {
          contentType: contentType,
        });

      if (error) {
        console.error("Supabase Upload Error:", error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: publicData } = supabase.storage
        .from('mechanics-uploads-bucket')
        .getPublicUrl(filePath);

      if (!publicData?.publicUrl) {
        throw new Error("Failed to get public URL");
      }

      console.log("✅ Upload successful:", publicData.publicUrl);
      return publicData.publicUrl;
    } catch (err: any) {
      console.error("Upload failed:", err.message || err);
      throw err;
    }
  }


  async function handleVideoUpload(type: UploadType, fileUri: string) {
    setIsUploading(true);
    try {
      const videoUrl = await uploadVideoToSupabase(fileUri, type);
      const score = +(7 + Math.random() * 3).toFixed(1); // Replace with real score from backend
      setHistory([{ type, score, date: new Date() }, ...history]);

      Alert.alert(
        'Analysis Complete!',
        `Your ${type} video has been analyzed.\nCheck the Analysis tab for detailed feedback.`,
        [{ text: 'View Analysis', onPress: () => {} }]
      );
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setIsUploading(false);
    }
  }

  const pickOrRecordVideo = async (source: 'camera' | 'library') => {
    let result;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Camera permission required', 'You must allow camera access to record a video.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: 'videos', quality: 1 });
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Library permission required', 'You must allow access to your media library.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'videos' });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await handleVideoUpload(selectedType!, result.assets[0].uri);
    }
  };

  const openCamera = () => {
    if (!selectedType) {
      Alert.alert('Please select a type first.');
      return;
    }
    Alert.alert('Camera Options', 'Choose how to capture your video', [
      { text: 'Take Video', onPress: () => pickOrRecordVideo('camera') },
      { text: 'Choose from Library', onPress: () => pickOrRecordVideo('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.centerContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Upload Video
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Record your swing or pitch for AI-powered analysis
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            What would you like to analyze?
          </ThemedText>

          <View style={styles.typeButtons}>
            <Pressable
              style={[
                styles.typeButton,
                selectedType === 'swing' && styles.selectedTypeButton,
              ]}
              onPress={() => setSelectedType('swing')}
            >
              <ThemedText
                style={[
                  styles.typeButtonText,
                  selectedType === 'swing' && styles.selectedTypeButtonText,
                ]}
              >
                🏏 Batting Swing
              </ThemedText>
              <ThemedText style={styles.typeDescription}>
                Analyze your batting technique, timing, and form
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.typeButton,
                selectedType === 'pitch' && styles.selectedTypeButton,
              ]}
              onPress={() => setSelectedType('pitch')}
            >
              <ThemedText
                style={[
                  styles.typeButtonText,
                  selectedType === 'pitch' && styles.selectedTypeButtonText,
                ]}
              >
                ⚾ Pitching
              </ThemedText>
              <ThemedText style={styles.typeDescription}>
                Analyze your pitching mechanics and delivery
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {selectedType && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Recording Tips
            </ThemedText>
            <View style={styles.tipsContainer}>
              <View style={styles.tip}>
                <ThemedText style={styles.tipEmoji}>📱</ThemedText>
                <ThemedText style={styles.tipText}>
                  Hold phone horizontally for best results
                </ThemedText>
              </View>
              <View style={styles.tip}>
                <ThemedText style={styles.tipEmoji}>📏</ThemedText>
                <ThemedText style={styles.tipText}>
                  Record from 10-15 feet away to capture full motion
                </ThemedText>
              </View>
              <View style={styles.tip}>
                <ThemedText style={styles.tipEmoji}>☀️</ThemedText>
                <ThemedText style={styles.tipText}>
                  Ensure good lighting and clear background
                </ThemedText>
              </View>
              <View style={styles.tip}>
                <ThemedText style={styles.tipEmoji}>⏱️</ThemedText>
                <ThemedText style={styles.tipText}>
                  Keep video 3-10 seconds for best analysis
                </ThemedText>
              </View>
            </View>
            <Pressable
              style={[
                styles.uploadButton,
                isUploading && { backgroundColor: '#b3cdfa' },
              ]}
              onPress={openCamera}
              disabled={isUploading}
            >
              <ThemedText style={styles.uploadButtonText}>
                {isUploading
                  ? 'Analyzing...'
                  : `Record ${selectedType === 'swing' ? 'Swing' : 'Pitch'}`}
              </ThemedText>
            </Pressable>
            {isUploading && (
              <View style={styles.processingContainer}>
                <ThemedText style={styles.processingText}>
                  🤖 AI is analyzing your technique...
                </ThemedText>
                <ThemedText style={styles.processingSubtext}>
                  This may take a few seconds
                </ThemedText>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Uploads
          </ThemedText>
          {history.length === 0 && (
            <ThemedText style={{ opacity: 0.5, textAlign: 'center' }}>
              No uploads yet. Try analyzing a video!
            </ThemedText>
          )}
          {history.map((item, idx) => (
            <View style={styles.historyItem} key={idx}>
              <View style={styles.historyBadge}>
                <ThemedText style={styles.historyBadgeText}>
                  {history.length - idx}
                </ThemedText>
              </View>
              <View style={styles.historyInfo}>
                <ThemedText type="defaultSemiBold" style={styles.historyTitle}>
                  {item.type === 'swing'
                    ? 'Swing Analysis'
                    : 'Pitch Analysis'}
                </ThemedText>
                <ThemedText style={styles.historyDate}>
                  {formatTimeAgo(item.date)}
                </ThemedText>
              </View>
              <ThemedText style={styles.historyScore}>{item.score}/10</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "#f4f8fc",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 30,
    paddingBottom: 30,
    minHeight: "100%",
  },
  card: {
    width: SCREEN_WIDTH < 400 ? "100%" : 360,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 6,
    alignItems: "stretch",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1850B5",
    marginBottom: 2,
  },
  headerSubtitle: {
    color: "#466",
    opacity: 0.77,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 2,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1850B5",
    marginBottom: 11,
  },
  typeButtons: {
    gap: 13,
  },
  typeButton: {
    backgroundColor: "#f7f9fc",
    paddingVertical: 19,
    paddingHorizontal: 15,
    borderRadius: 13,
    borderWidth: 1.7,
    borderColor: "#e1e9f6",
    marginBottom: 10,
    elevation: 2,
  },
  selectedTypeButton: {
    backgroundColor: "#e6f3ff",
    borderColor: "#007AFF",
  },
  typeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#22334a",
  },
  selectedTypeButtonText: {
    color: "#007AFF",
  },
  typeDescription: {
    opacity: 0.73,
    fontSize: 14,
    color: "#334a66",
  },
  tipsContainer: {
    backgroundColor: "#f9f9f9",
    padding: 17,
    borderRadius: 10,
    marginBottom: 15,
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 2,
  },
  tipEmoji: {
    fontSize: 19,
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.8,
    color: "#1d2940",
  },
  uploadButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 13,
    elevation: 2,
  },
  uploadButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
  processingContainer: {
    backgroundColor: "#e7f3fe",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  processingText: {
    fontSize: 16,
    marginBottom: 4,
    color: "#1d2940",
  },
  processingSubtext: {
    opacity: 0.7,
    fontSize: 13,
    color: "#224",
  },
  // History
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f7fa",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.11,
    shadowRadius: 6,
    elevation: 1,
  },
  historyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#b2d4fa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  historyBadgeText: {
    fontWeight: "700",
    color: "#2267D5",
    fontSize: 15,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#22334a",
  },
  historyDate: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: 2,
    color: "#444",
  },
  historyScore: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
    marginLeft: 7,
  },
});
