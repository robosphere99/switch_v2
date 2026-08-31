import { useState, useEffect, useCallback, useRef } from 'react';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { APP_VERSION } from '../../App';
import { API_URL } from '../api/client';

const API_BASE = API_URL.replace(/\/api$/, '');

/* ─── Types ──────────────────────────────────────────────────── */

export interface NativeUpdateInfo {
    latestVersion: string;
    downloadUrl: string;
    releaseNotes?: string;
    isMandatory: boolean;
    updateMessage?: string;
}

export interface AutoUpdateState {
    /* JS OTA (expo-updates) */
    jsChecking: boolean;
    jsDownloading: boolean;
    jsUpdateReady: boolean;
    jsError: string | null;

    /* Native APK */
    nativeUpdate: NativeUpdateInfo | null;
    nativeDownloading: boolean;
    nativeProgress: number;
    nativeError: string | null;
    nativeInstalling: boolean;
}

export interface AutoUpdateActions {
    /** Reload the app with the downloaded JS update */
    reloadWithJsUpdate: () => Promise<void>;
    /** Retry JS OTA check after an error */
    retryJsCheck: () => void;
    /** Download and install the native APK update */
    downloadAndInstallNative: () => Promise<void>;
    /** Dismiss native update popup (only for non-mandatory) */
    dismissNativeUpdate: () => void;
    /** Retry native APK download after an error */
    retryNativeDownload: () => void;
    /** Manually trigger both checks (for Settings "Check for Updates") */
    manualCheck: () => void;
}

/* ─── Semver compare ─────────────────────────────────────────── */

const compareSemver = (v1: string, v2: string): number => {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((p1[i] || 0) < (p2[i] || 0)) return -1;
        if ((p1[i] || 0) > (p2[i] || 0)) return 1;
    }
    return 0;
};

/* ─── Hook ───────────────────────────────────────────────────── */

export function useAutoUpdate(): [AutoUpdateState, AutoUpdateActions] {
    const [jsChecking, setJsChecking] = useState(false);
    const [jsDownloading, setJsDownloading] = useState(false);
    const [jsUpdateReady, setJsUpdateReady] = useState(false);
    const [jsError, setJsError] = useState<string | null>(null);

    const [nativeUpdate, setNativeUpdate] = useState<NativeUpdateInfo | null>(null);
    const [nativeDownloading, setNativeDownloading] = useState(false);
    const [nativeProgress, setNativeProgress] = useState(0);
    const [nativeError, setNativeError] = useState<string | null>(null);
    const [nativeInstalling, setNativeInstalling] = useState(false);

    const dismissed = useRef(false);
    const hasChecked = useRef(false);

    /* ── JS OTA Check ──────────────────────────────────────── */

    const checkJsUpdate = useCallback(async () => {
        // expo-updates only works in standalone (production/preview) builds
        if (__DEV__) return;

        setJsChecking(true);
        setJsError(null);

        try {
            const check = await Updates.checkForUpdateAsync();

            if (check.isAvailable) {
                setJsDownloading(true);

                const result = await Updates.fetchUpdateAsync();

                if (result.isNew) {
                    setJsUpdateReady(true);
                }
            }
        } catch (e: any) {
            console.warn('[AutoUpdate] JS OTA check failed:', e.message);
            // Don't show error to user for background checks — only for manual checks
            setJsError(e.message || 'JS update check failed');
        } finally {
            setJsChecking(false);
            setJsDownloading(false);
        }
    }, []);

    const reloadWithJsUpdate = useCallback(async () => {
        try {
            await Updates.reloadAsync();
        } catch (e: any) {
            console.warn('[AutoUpdate] JS reload failed:', e.message);
            setJsError('Could not restart app. Please close and reopen manually.');
        }
    }, []);

    const retryJsCheck = useCallback(() => {
        setJsError(null);
        setJsUpdateReady(false);
        checkJsUpdate();
    }, [checkJsUpdate]);

    /* ── Native APK Check ──────────────────────────────────── */

    const checkNativeUpdate = useCallback(async () => {
        if (Platform.OS !== 'android') return;

        try {
            const { api: apiInstance } = await import('../api/client');
            const res = await apiInstance.get('/version');

            if (res.data?.success && res.data?.data?.mobileAppOptions) {
                const opts = res.data.data.mobileAppOptions;
                const serverVersion = opts.latestVersion;

                if (serverVersion && compareSemver(APP_VERSION, serverVersion) < 0) {
                    // Newer version available on server
                    setNativeUpdate({
                        latestVersion: serverVersion,
                        downloadUrl: opts.downloadUrl,
                        releaseNotes: opts.releaseNotes || undefined,
                        isMandatory: opts.isMandatory === true || (opts.minRequiredVersion && compareSemver(APP_VERSION, opts.minRequiredVersion) < 0),
                        updateMessage: opts.updateMessage || undefined,
                    });
                }
            }
        } catch (e: any) {
            console.log('[AutoUpdate] Native version check failed (safe bypass):', e.message);
        }
    }, []);

    const downloadAndInstallNative = useCallback(async () => {
        if (!nativeUpdate?.downloadUrl || nativeDownloading) return;

        setNativeDownloading(true);
        setNativeProgress(0);
        setNativeError(null);

        try {
            let downloadUrl = nativeUpdate.downloadUrl;
            // Normalize URL
            if (!downloadUrl.startsWith('http')) {
                downloadUrl = API_BASE + downloadUrl;
            }

            const fileUri = FileSystem.cacheDirectory + 'SwitchNestUpdate.apk';

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    setNativeProgress(Math.min(progress, 1));
                }
            );

            const result = await downloadResumable.downloadAsync();

            if (result?.uri) {
                setNativeInstalling(true);
                const { installApk } = await import('../../modules/apk-extractor/src');
                const success = await installApk(result.uri.replace('file://', ''));

                if (!success) {
                    setNativeError('Could not launch the package installer. Check app permissions.');
                }
                // If installApk succeeds, the system package installer takes over.
                // User can come back if they cancel the system installer.
            } else {
                setNativeError('Download completed but the file was not found.');
            }
        } catch (e: any) {
            console.warn('[AutoUpdate] Native download failed:', e.message);
            setNativeError(e.message || 'Download failed. Check your internet connection.');
        } finally {
            setNativeDownloading(false);
            setNativeInstalling(false);
        }
    }, [nativeUpdate, nativeDownloading]);

    const dismissNativeUpdate = useCallback(() => {
        if (nativeUpdate?.isMandatory) return; // Can't dismiss mandatory
        dismissed.current = true;
        setNativeUpdate(null);
    }, [nativeUpdate]);

    const retryNativeDownload = useCallback(() => {
        setNativeError(null);
        setNativeProgress(0);
        downloadAndInstallNative();
    }, [downloadAndInstallNative]);

    /* ── Manual Check (for Settings button) ────────────────── */

    const manualCheck = useCallback(() => {
        setJsError(null);
        setNativeError(null);
        dismissed.current = false;
        hasChecked.current = false;
        checkJsUpdate();
        checkNativeUpdate();
    }, [checkJsUpdate, checkNativeUpdate]);

    /* ── Auto-check on mount ───────────────────────────────── */

    useEffect(() => {
        if (hasChecked.current) return;
        hasChecked.current = true;

        // Small delay so app renders first, then check in background
        const timer = setTimeout(() => {
            checkJsUpdate();
            checkNativeUpdate();
        }, 3000);

        return () => clearTimeout(timer);
    }, [checkJsUpdate, checkNativeUpdate]);

    /* ── Return ────────────────────────────────────────────── */

    const state: AutoUpdateState = {
        jsChecking,
        jsDownloading,
        jsUpdateReady,
        jsError,
        nativeUpdate: dismissed.current ? null : nativeUpdate,
        nativeDownloading,
        nativeProgress,
        nativeError,
        nativeInstalling,
    };

    const actions: AutoUpdateActions = {
        reloadWithJsUpdate,
        retryJsCheck,
        downloadAndInstallNative,
        dismissNativeUpdate,
        retryNativeDownload,
        manualCheck,
    };

    return [state, actions];
}
