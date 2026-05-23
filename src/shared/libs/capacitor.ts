import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): 'android' | 'ios' | 'web' => {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
};

export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';
export const isWeb = (): boolean => getPlatform() === 'web';
