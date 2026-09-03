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
        background: '#f8fafc',
        card: '#ffffff',
        text: '#0f172a',
        textSecondary: '#64748b',
        primary: '#3b82f6',
        primaryGlow: 'rgba(59, 130, 246, 0.4)',
        accent: '#8b5cf6', // Violet Accent
        accentGlow: 'rgba(139, 92, 246, 0.4)',
        danger: '#ef4444',
        success: '#10b981',
        border: '#e2e8f0',
        tabBar: '#ffffff',
    },
    defaultDark: {
        id: 'defaultDark',
        name: 'Titanium Gold (Premium)',
        isPremium: false,
        background: '#121212',
        card: '#1C1C1E',
        text: '#FFFFFF',
        textSecondary: '#A1A1AA',
        primary: '#FACC15', // Vibrant Gold/Yellow
        primaryGlow: 'rgba(250, 204, 21, 0.4)',
        accent: '#D97706', // Deep Amber
        accentGlow: 'rgba(217, 119, 6, 0.4)',
        danger: '#EF4444',
        success: '#10B981',
        border: '#27272A',
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
