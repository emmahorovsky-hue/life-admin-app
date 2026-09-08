import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { Input, SheetInput } from './Input';

export type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'>;

/**
 * Password field with a show/hide eye toggle (LIF-264). Two exports for the
 * same reason `Input`/`SheetInput` are two components: the sheet variant must
 * render a `BottomSheetTextInput` underneath, which throws outside a sheet.
 */
export function PasswordInput(props: PasswordInputProps) {
  return <PasswordField input={(p) => <Input {...p} />} {...props} />;
}

export function SheetPasswordInput(props: PasswordInputProps) {
  return <PasswordField input={(p) => <SheetInput {...p} />} {...props} />;
}

function PasswordField({
  input,
  style,
  ...props
}: PasswordInputProps & { input: (props: TextInputProps) => ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      {input({ ...props, secureTextEntry: !visible, style: [styles.input, style] })}
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={({ pressed }) => [styles.eye, pressed && styles.eyePressed]}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  input: {
    // clears the eye button; on top of the input's own horizontal padding
    paddingRight: 44,
  },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyePressed: {
    opacity: 0.5,
  },
});
