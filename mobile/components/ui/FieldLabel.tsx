import { StyleSheet } from 'react-native';
import { AppText, AppTextProps } from './AppText';

/** Monospace uppercase field label ("FIRST NAME") above an Input. */
export function FieldLabel({ style, ...props }: AppTextProps) {
  return <AppText variant="monoLabel" muted style={[styles.label, style]} {...props} />;
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
});
