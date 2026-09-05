import { requireNativeModule } from 'expo-modules-core';

const ApkExtractor = requireNativeModule('ApkExtractor');

export function getApkPath(): string {
  return ApkExtractor.getApkPath();
}

export async function installApk(path: string): Promise<boolean> {
  return await ApkExtractor.installApk(path);
}
