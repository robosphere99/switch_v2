import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppThemes, ThemePalette } from './colors';
import { StatusBar, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
    theme: ThemePalette;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => Promise<void>;
    themeId: string;
    setThemeId: (id: string) => Promise<void>;
    availableThemes: ThemePalette[];
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>('dark');
    const [activeThemeId, setActiveThemeId] = useState<string>('defaultDark');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                let currentMode: ThemeMode = 'dark';
                const savedMode = await SecureStore.getItemAsync('user_theme_mode') as ThemeMode;
                if (savedMode && ['light', 'dark'].includes(savedMode)) {
                    currentMode = savedMode;
                    setModeState(currentMode);
                }

                const savedTheme = await SecureStore.getItemAsync('user_theme_pref');

                if (savedTheme && AppThemes[savedTheme]) {
                    setActiveThemeId(savedTheme);
                } else if (currentMode === 'light') {
                    setActiveThemeId('defaultLight');
                } else if (currentMode === 'dark') {
                    setActiveThemeId('defaultDark');
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

    useEffect(() => {
        if (!isLoaded) return;
        // Native OS appearance syncing removed as per user request to enforce strict manual light/dark locks.
    }, [mode, isLoaded]);

    const setMode = async (newMode: ThemeMode) => {
        setModeState(newMode);
        await SecureStore.setItemAsync('user_theme_mode', newMode);

        let targetTheme = activeThemeId;
        if (newMode === 'light') targetTheme = 'defaultLight';
        else if (newMode === 'dark') targetTheme = 'defaultDark';

        if (targetTheme !== activeThemeId) {
            await changeTheme(targetTheme);
        }
    };

    const changeTheme = async (id: string) => {
        if (AppThemes[id]) {
            setActiveThemeId(id);
            await SecureStore.setItemAsync('user_theme_pref', id);
        }
    };

    if (!isLoaded) return null; // Wait for memory check

    const currentTheme = AppThemes[activeThemeId] || AppThemes['defaultDark'];
    const isLight = currentTheme.background.toLowerCase() === '#f8fafc' || currentTheme.background.toLowerCase() === '#ffffff';

    return (
        <ThemeContext.Provider
            value={{
                theme: currentTheme,
                mode,
                setMode,
                themeId: activeThemeId,
                setThemeId: changeTheme,
                availableThemes: Object.values(AppThemes)
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
