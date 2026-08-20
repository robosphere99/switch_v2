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
        danger: '#ef4444',
        success: '#10b981',
        border: '#e2e8f0',
        tabBar: '#ffffff',
    },
    defaultDark: {
        id: 'defaultDark',
        name: 'Midnight Slate (Classic)',
        isPremium: false,
        background: '#0f172a',
        card: '#1e293b',
        text: '#f8fafc',
        textSecondary: '#94a3b8',
        primary: '#3b82f6',
        primaryGlow: 'rgba(59, 130, 246, 0.4)',
        danger: '#ef4444',
        success: '#10b981',
        border: '#334155',
        tabBar: '#0f172a',
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
        danger: '#f43f5e',
        success: '#22c55e',
        border: '#27272a',
        tabBar: '#09090b',
    }
};
