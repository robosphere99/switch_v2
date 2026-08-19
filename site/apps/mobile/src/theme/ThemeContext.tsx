import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppThemes, ThemePalette } from './colors';
import { StatusBar } from 'react-native';

type ThemeContextType = {
    theme: ThemePalette;
    themeId: string;
    setThemeId: (id: string) => Promise<void>;
    availableThemes: ThemePalette[];
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeThemeId, setActiveThemeId] = useState<string>('defaultDark');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load previously selected theme on app startup
        const loadSavedTheme = async () => {
            try {
                const saved = await SecureStore.getItemAsync('user_theme_pref');
                if (saved && AppThemes[saved]) {
                    setActiveThemeId(saved);
                }
            } catch (e) {
                console.log('Failed to load theme preference', e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadSavedTheme();
    }, []);

    const changeTheme = async (id: string) => {
        if (AppThemes[id]) {
            setActiveThemeId(id);
            await SecureStore.setItemAsync('user_theme_pref', id);
        }
    };

    if (!isLoaded) return null; // Wait for memory check

    const currentTheme = AppThemes[activeThemeId];

    return (
        <ThemeContext.Provider
            value={{
                theme: currentTheme,
                themeId: activeThemeId,
                setThemeId: changeTheme,
                availableThemes: Object.values(AppThemes)
            }}
        >
            {/* Universal status bar handling based on background style */}
            <StatusBar barStyle="light-content" backgroundColor={currentTheme.background} />
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
