export type ThemePalette = {
    id: string;
    name: string;
    isPremium: boolean;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    primaryGlow: string;
    accent: string;
    accentGlow: string;
    danger: string;
    success: string;
    border: string;
    tabBar: string;
};

export const AppThemes: Record<string, ThemePalette> = {
    defaultLight: {
        id: 'defaultLight',
        name: 'Snow White (Classic)',
        isPremium: false,
        background: '#f4f4f5',
        card: '#ffffff',
        text: '#09090b',
        textSecondary: '#71717a',
        primary: '#09090b',
        primaryGlow: 'rgba(9, 9, 11, 0.2)',
        accent: '#18181b',
        accentGlow: 'rgba(24, 24, 27, 0.2)',
        danger: '#ef4444',
        success: '#10b981',
        border: '#e4e4e7',
        tabBar: '#ffffff',
    },
    defaultDark: {
        id: 'defaultDark',
        name: 'Obsidian Black (Minimal)',
        isPremium: false,
        background: '#000000',
        card: '#09090b',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        primary: '#ffffff',
        primaryGlow: 'rgba(255, 255, 255, 0.25)',
        accent: '#27272a',
        accentGlow: 'rgba(255, 255, 255, 0.15)',
        danger: '#ef4444',
        success: '#10b981',
        border: '#27272a',
        tabBar: '#000000',
    },
    glassOcean: {
        id: 'glassOcean',
        name: 'Deep Ocean (Premium)',
        isPremium: true,
        background: '#082f49',
        card: 'rgba(255, 255, 255, 0.08)',
        text: '#f0f9ff',
        textSecondary: '#bae6fd',
        primary: '#0ea5e9',
        primaryGlow: 'rgba(14, 165, 233, 0.5)',
        accent: '#f59e0b', // Amber Accent
        accentGlow: 'rgba(245, 158, 11, 0.5)',
        danger: '#fb7185',
        success: '#34d399',
        border: 'rgba(255, 255, 255, 0.15)',
        tabBar: '#153c51',
    },
    neonCyber: {
        id: 'neonCyber',
        name: 'Cyberpunk (Premium)',
        isPremium: true,
        background: '#000000',
        card: '#111111',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        primary: '#d946ef',
        primaryGlow: 'rgba(217, 70, 239, 0.5)',
        accent: '#06b6d4', // Cyan Accent
        accentGlow: 'rgba(6, 182, 212, 0.5)',
        danger: '#f43f5e',
        success: '#22c55e',
        border: '#27272a',
        tabBar: '#09090b',
    },
    indiaHeritage: {
        id: 'indiaHeritage',
        name: 'India Tiranga',
        isPremium: true,
        background: '#FFFFFF', // White Center
        card: '#F8FAFC',
        text: '#0F172A',       // Ashoka Navy
        textSecondary: '#64748B',
        primary: '#FF671F',    // Saffron 
        primaryGlow: 'rgba(255, 103, 31, 0.4)',
        accent: '#046A38',     // India Green 
        accentGlow: 'rgba(4, 106, 56, 0.4)',
        danger: '#DC2626',
        success: '#16A34A',
        border: '#E2E8F0',
        tabBar: '#FFFFFF',
    },
    cherryBlossom: {
        id: 'cherryBlossom',
        name: 'Sakura Pink',
        isPremium: true,
        background: '#FFF0F5',
        card: '#FFFFFF',
        text: '#4A0E2E',
        textSecondary: '#9A5B7E',
        primary: '#FF69B4',
        primaryGlow: 'rgba(255, 105, 180, 0.4)',
        accent: '#FF1493',
        accentGlow: 'rgba(255, 20, 147, 0.4)',
        danger: '#DC143C',
        success: '#10B981',
        border: '#FFC0CB',
        tabBar: '#FFF0F5',
    }
};
