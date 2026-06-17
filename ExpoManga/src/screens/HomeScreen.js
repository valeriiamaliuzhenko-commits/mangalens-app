import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Alert, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { Button, Card, SectionLabel } from '../components';
import { uploadManga } from '../services/api';

export default function HomeScreen({ navigation }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
      setLoading(true);
    try {
      const data = await uploadManga(
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType,
      );
      navigation.navigate('Viewer', {
        session_id: data.session_id,
        totalPages: data.total_pages,
        title: selectedFile.name,
      });
    } catch (err) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fileExt = selectedFile?.name?.split('.').pop()?.toUpperCase() ?? null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>漫</Text>
          <View>
            <Text style={styles.logoTitle}>MangaLens</Text>
            <Text style={styles.logoSub}>AI-Powered Translator</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handlePickFile} activeOpacity={0.8}
          style={[styles.dropZone, selectedFile && styles.dropZoneActive]}>
          <Text style={styles.dropIcon}>{selectedFile ? '📄' : '📂'}</Text>
          {selectedFile ? (
            <>
              <Text style={styles.dropTitle} numberOfLines={2}>{selectedFile.name}</Text>
              <Text style={styles.dropMeta}>{fileExt}</Text>
              <Text style={styles.dropHint}>Tap to change</Text>
            </>
          ) : (
            <>
              <Text style={styles.dropTitle}>Select Manga File</Text>
              <Text style={styles.dropHint}>PDF or image (JPG, PNG, WEBP)</Text>
            </>
          )}
        </TouchableOpacity>

        <SectionLabel text="How it works" />
        <View style={styles.stepsRow}>
          {[
            { num: '1', icon: '📥', label: 'Upload PDF or image' },
            { num: '2', icon: '🔍', label: 'Browse pages' },
            { num: '3', icon: '🤖', label: 'Translate with AI' },
          ].map(s => (
            <Card key={s.num} style={styles.stepCard}>
              <Text style={styles.stepNum}>{s.num}</Text>
              <Text style={styles.stepIcon}>{s.icon}</Text>
              <Text style={styles.stepText}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.modelCard}>
          <View style={styles.modelRow}>
            <View style={styles.modelDot} />
            <Text style={styles.modelName}>Gemini 2.5 Flash</Text>
          </View>
          <Text style={styles.modelDesc}>
            Reads manga panels right-to-left and returns clean English dialogue.
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={loading ? 'Processing...' : 'Open & Translate'}
          onPress={handleUpload} loading={loading} disabled={!selectedFile} style={styles.cta} />
        {!selectedFile && <Text style={styles.footerHint}>Select a file to continue</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logoIcon: { fontSize: 36, color: Colors.accent, fontWeight: Typography.bold, marginRight: Spacing.sm },
  logoTitle: { fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  logoSub: { fontSize: Typography.sm, color: Colors.textSecondary },
  body: { padding: Spacing.xl, paddingBottom: 120, gap: Spacing.xl },
  dropZone: {
    borderRadius: Radius.xl, borderWidth: 2, borderColor: Colors.border,
    borderStyle: 'dashed', backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xl, gap: Spacing.sm,
  },
  dropZoneActive: { borderColor: Colors.accent, backgroundColor: Colors.bgElevated, borderStyle: 'solid' },
  dropIcon: { fontSize: 48, marginBottom: Spacing.sm },
  dropTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, textAlign: 'center' },
  dropMeta: { fontSize: Typography.sm, color: Colors.accentLight, fontWeight: Typography.medium },
  dropHint: { fontSize: Typography.sm, color: Colors.textMuted },
  stepsRow: { flexDirection: 'row', gap: Spacing.md },
  stepCard: { flex: 1, alignItems: 'center', padding: Spacing.md, gap: Spacing.xs },
  stepNum: { fontSize: Typography.xs, fontWeight: Typography.extrabold, color: Colors.accent },
  stepIcon: { fontSize: 22 },
  stepText: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 },
  modelCard: { gap: Spacing.sm },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modelDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: '#4ADE80' },
  modelName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modelDesc: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, paddingBottom: Platform.OS === 'android' ? Spacing.xl : 34,
    backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
    gap: Spacing.sm, alignItems: 'center',
  },
  cta: { width: '100%' },
  footerHint: { fontSize: Typography.sm, color: Colors.textMuted },
});