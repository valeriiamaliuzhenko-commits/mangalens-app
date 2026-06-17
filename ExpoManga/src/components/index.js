// src/components/index.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

// ─── Button ──────────────────────────────────────────────────────────────────

export function Button({ title, onPress, loading, disabled, variant = 'primary', style }) {
  const isSecondary = variant === 'secondary';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.btn,
        isSecondary ? styles.btnSecondary : styles.btnPrimary,
        isDisabled && styles.btnDisabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={isSecondary ? Colors.accent : Colors.textInverse}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            isSecondary ? styles.btnTextSecondary : styles.btnTextPrimary,
            isDisabled && styles.btnTextDisabled,
          ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color ?? Colors.accentGlow }]}>
      <Text style={[styles.badgeText, { color: color ? '#fff' : Colors.accentLight }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ text }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
  },
  btnPrimary: {
    backgroundColor: Colors.accent,
    ...Shadow.accent,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    letterSpacing: 0.3,
  },
  btnTextPrimary: {
    color: '#fff',
  },
  btnTextSecondary: {
    color: Colors.accent,
  },
  btnTextDisabled: {
    opacity: 0.7,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
