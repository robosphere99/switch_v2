import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppThemes, ThemePalette } from './colors';
import { StatusBar, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

type ThemeContextType = {
    theme: ThemePalette;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => Promise<void>;
    themeId: string;
    setThemeId: (id: string) => Promise<void>;
    availableThemes: ThemePalette[];
    bindUser: (userId: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>('auto');
    const [activeThemeId, setActiveThemeId] = useState<string>('glassOcean');
    const [activeUserId, setActiveUserId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                let currentMode: ThemeMode = 'auto'; // default to auto instead of dark
                const savedMode = await SecureStore.getItemAsync('user_theme_mode') as ThemeMode;
                if (savedMode && ['light', 'dark', 'auto'].includes(savedMode)) {
                    currentMode = savedMode;
                    setModeState(currentMode);
                }

                const savedTheme = await SecureStore.getItemAsync('user_theme_pref');

                if (savedTheme && AppThemes[savedTheme]) {
                    setActiveThemeId(savedTheme);
                } else if (currentMode === 'light') {
                    setActiveThemeId('defaultLight');
                } else if (currentMode === 'dark') {
                    setActiveThemeId('glassOcean');
                }
            } catch (e) {
                console.log('Failed to load settings', e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadSavedSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const systemColorScheme = useColorScheme();

    useEffect(() => {
        if (!isLoaded) return;
        if (mode === 'auto') {
            const autoTheme = systemColorScheme === 'dark' ? 'glassOcean' : 'defaultLight';
            if (activeThemeId !== autoTheme) {
                // Only override standard defaults so they track OS, ignore if they explicitly tapped a custom premium theme previously
                if (activeThemeId === 'glassOcean' || activeThemeId === 'defaultLight' || activeThemeId === 'defaultDark') {
                    setActiveThemeId(autoTheme);
                }
            }
        }
    }, [mode, systemColorScheme, isLoaded]);

    const bindUser = async (userId: string) => {
        setActiveUserId(userId);
        try {
            const savedTheme = await SecureStore.getItemAsync(`user_theme_pref_${userId}`);
            if (savedTheme && AppThemes[savedTheme]) {
                setActiveThemeId(savedTheme);
            }
        } catch (e) {
            console.log('Failed to bind user theme:', e);
        }
    };

    const setMode = async (newMode: ThemeMode) => {
        setModeState(newMode);
        await SecureStore.setItemAsync('user_theme_mode', newMode);

        if (newMode === 'light') {
            await changeTheme('defaultLight');
        } else if (newMode === 'dark') {
            await changeTheme('defaultDark');
        } else if (newMode === 'auto') {
            const autoTheme = systemColorScheme === 'dark' ? 'glassOcean' : 'defaultLight';
            await changeTheme(autoTheme);
        }
    };

    const changeTheme = async (id: string) => {
        if (AppThemes[id]) {
            setActiveThemeId(id);
            if (activeUserId) {
                await SecureStore.setItemAsync(`user_theme_pref_${activeUserId}`, id);
            } else {
                await SecureStore.setItemAsync('user_theme_pref', id);
            }
        }
    };

    if (!isLoaded) return null; // Wait for memory check

    const currentTheme = AppThemes[activeThemeId] || AppThemes['glassOcean'];
    const isLight = currentTheme.background.toLowerCase() === '#f8fafc' || currentTheme.background.toLowerCase() === '#ffffff';

    return (
        <ThemeContext.Provider
            value={{
                theme: currentTheme,
                mode,
                setMode,
                themeId: activeThemeId,
                setThemeId: changeTheme,
                availableThemes: Object.values(AppThemes),
                bindUser
            }}
        >
            <StatusBar barStyle={isLight ? "dark-content" : "light-content"} backgroundColor={currentTheme.background} animated />
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
