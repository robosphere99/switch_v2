import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react-native';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

interface ThemedAlertProps {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttons?: AlertButton[];
    onDismiss: () => void;
}

const ICON_MAP = {
    success: { Icon: CheckCircle, color: '#10b981' },
    error: { Icon: XCircle, color: '#ef4444' },
    warning: { Icon: AlertTriangle, color: '#f59e0b' },
    info: { Icon: Info, color: '#3b82f6' },
    confirm: { Icon: AlertTriangle, color: '#f59e0b' },
};

export function ThemedAlert({ visible, title, message, type = 'info', buttons, onDismiss }: ThemedAlertProps) {
    const { theme } = useTheme();
    const { Icon, color } = ICON_MAP[type];

    const resolvedButtons: AlertButton[] = buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', onPress: onDismiss }];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={[styles.iconRing, { backgroundColor: color + '15' }]}>
                        <Icon color={color} size={28} />
                    </View>

                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

                    <View style={styles.buttonRow}>
                        {resolvedButtons.map((btn, i) => {
                            const isCancel = btn.style === 'cancel';
                            const isDestructive = btn.style === 'destructive';
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.button,
                                        {
                                            flex: 1,
                                            backgroundColor: isCancel
                                                ? theme.card
                                                : isDestructive
                                                    ? '#ef4444'
                                                    : color,
                                            borderWidth: isCancel ? 1 : 0,
                                            borderColor: theme.border,
                                        },
                                    ]}
                                    onPress={() => {
                                        btn.onPress?.();
                                        onDismiss();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            {
                                                color: isCancel ? theme.textSecondary : '#fff',
                                                fontWeight: isCancel ? '600' : '700',
                                            },
                                        ]}
                                    >
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

/**
 * Hook that returns a `showAlert` function mirroring Alert.alert signature
 * but rendering a themed modal instead.
 */
export function useThemedAlert() {
    const [alertState, setAlertState] = React.useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
        buttons: AlertButton[];
    }>({ visible: false, title: '', message: '', type: 'info', buttons: [] });

    const showAlert = React.useCallback(
        (title: string, message: string, buttons?: AlertButton[], type?: AlertType) => {
            setAlertState({
                visible: true,
                title,
                message,
                type: type ?? inferType(title),
                buttons: buttons ?? [],
            });
        },
        [],
    );

    const dismiss = React.useCallback(() => {
        setAlertState(prev => ({ ...prev, visible: false }));
    }, []);

    const AlertComponent = React.useMemo(
        () => (
            <ThemedAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
                buttons={alertState.buttons}
                onDismiss={dismiss}
            />
        ),
        [alertState, dismiss],
    );

    return { showAlert, AlertComponent };
}

function inferType(title: string): AlertType {
    const t = title.toLowerCase();
    if (t.includes('success') || t.includes('copied') || t.includes('updated')) return 'success';
    if (t.includes('error') || t.includes('failed') || t.includes('cannot')) return 'error';
    if (t.includes('warning') || t.includes('remove') || t.includes('delete') || t.includes('log out')) return 'warning';
    return 'info';
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#00000080',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    iconRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    button: {
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 15,
    },
});
