import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../theme';

export default function CoverOptionsModal({
  visible,
  onClose,
  title,
  showRename = false,
  initialTitle = '',
  onRename,
  showPageOption = false,
  totalPages = 0,
  onUsePage,
  onUploadImage,
  hasCustomCover = false,
  onRevert,
}) {
  const [renameValue, setRenameValue] = useState(initialTitle);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageNumInput, setPageNumInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to choose a cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setLoading(true);
    try {
      await onUploadImage(result.assets[0].base64);
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Failed to set cover.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsePageSubmit = async () => {
    const num = parseInt(pageNumInput, 10);
    if (isNaN(num) || num < 1 || num > totalPages) {
      Alert.alert('Invalid page', `Enter a number between 1 and ${totalPages}`);
      return;
    }
    setLoading(true);
    try {
      await onUsePage(num - 1);
      setShowPageInput(false);
      setPageNumInput('');
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Failed to set cover.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSave = () => {
    if (renameValue.trim()) {
      onRename(renameValue.trim());
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>

          {showRename && (
            <View style={styles.renameBlock}>
              <Text style={styles.label}>Rename</Text>
              <TextInput
                style={styles.input}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleRenameSave}>
                <Text style={styles.actionBtnText}>Save Name</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Cover Image</Text>

          {showPageOption && !showPageInput && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPageInput(true)}>
              <Text style={styles.actionBtnText}>📄 Use a page as cover</Text>
            </TouchableOpacity>
          )}

          {showPageOption && showPageInput && (
            <View style={styles.pageInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={pageNumInput}
                onChangeText={setPageNumInput}
                keyboardType="number-pad"
                placeholder={`1 - ${totalPages}`}
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              <TouchableOpacity style={styles.goBtn} onPress={handleUsePageSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.goBtnText}>Set</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.actionBtn} onPress={handlePickImage} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.textPrimary} size="small" /> : <Text style={styles.actionBtnText}>🖼 Choose from gallery</Text>}
          </TouchableOpacity>

          {hasCustomCover && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.dangerBtn]}
              onPress={() => { onRevert(); onClose(); }}
            >
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>↺ Revert to default cover</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  box: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xl, width: '100%', gap: Spacing.md,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  label: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },
  renameBlock: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base,
  },
  pageInputRow: { flexDirection: 'row', gap: Spacing.sm },
  goBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center', alignItems: 'center', minWidth: 64,
  },
  goBtnText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.sm },
  actionBtn: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  dangerBtn: { borderColor: Colors.error },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  cancelText: { color: Colors.textMuted, fontSize: Typography.base },
});