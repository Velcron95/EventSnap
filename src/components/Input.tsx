import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, borderRadius, spacing } from '../styles/theme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  inputStyle,
  multiline,
  numberOfLines,
  maxLength,
}) => {
  const [isSecureTextVisible, setIsSecureTextVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          error && styles.error,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.input.placeholder}
          secureTextEntry={secureTextEntry && !isSecureTextVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[styles.input, inputStyle]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecureTextVisible(!isSecureTextVisible)}
            style={styles.icon}
          >
            <MaterialIcons
              name={isSecureTextVisible ? 'visibility' : 'visibility-off'}
              size={24}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.input.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  focused: {
    borderColor: colors.primary,
  },
  error: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  icon: {
    padding: spacing.xs,
  },
}); 