import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { isNativePlatform } from './capacitor';

export type PushPermissionState = 'granted' | 'denied' | 'prompt';

export type PushNotificationData = {
  id: string;
  title?: string;
  body?: string;
  data: Record<string, unknown>;
};

type PushListeners = {
  onRegistration?: (token: string) => void;
  onRegistrationError?: (error: Error) => void;
  onNotificationReceived?: (notification: PushNotificationData) => void;
  onNotificationAction?: (notification: PushNotificationData, actionId: string) => void;
};

let listeners: PushListeners = {};
let isInitialized = false;

export const checkPushPermissions = async (): Promise<PushPermissionState> => {
  if (!isNativePlatform()) {
    return 'denied';
  }

  const status = await PushNotifications.checkPermissions();
  if (status.receive === 'granted') return 'granted';
  if (status.receive === 'denied') return 'denied';
  return 'prompt';
};

export const requestPushPermissions = async (): Promise<PushPermissionState> => {
  if (!isNativePlatform()) {
    return 'denied';
  }

  const status = await PushNotifications.requestPermissions();
  if (status.receive === 'granted') return 'granted';
  if (status.receive === 'denied') return 'denied';
  return 'prompt';
};

const setupListeners = () => {
  if (isInitialized) return;
  isInitialized = true;

  PushNotifications.addListener('registration', (token: Token) => {
    listeners.onRegistration?.(token.value);
  });

  PushNotifications.addListener('registrationError', (error) => {
    listeners.onRegistrationError?.(new Error(error.error));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    listeners.onNotificationReceived?.({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      data: notification.data || {}
    });
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    listeners.onNotificationAction?.(
      {
        id: action.notification.id,
        title: action.notification.title,
        body: action.notification.body,
        data: action.notification.data || {}
      },
      action.actionId
    );
  });
};

export const initializePushNotifications = async (callbacks: PushListeners): Promise<string | null> => {
  if (!isNativePlatform()) {
    return null;
  }

  listeners = callbacks;
  setupListeners();

  const permission = await requestPushPermissions();
  if (permission !== 'granted') {
    return null;
  }

  await PushNotifications.register();

  return new Promise((resolve) => {
    const originalOnRegistration = listeners.onRegistration;
    listeners.onRegistration = (token: string) => {
      originalOnRegistration?.(token);
      resolve(token);
    };

    setTimeout(() => resolve(null), 10000);
  });
};

export const getDeliveredNotifications = async (): Promise<PushNotificationData[]> => {
  if (!isNativePlatform()) {
    return [];
  }

  const { notifications } = await PushNotifications.getDeliveredNotifications();
  return notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    data: n.data || {}
  }));
};

export const removeDeliveredNotifications = async (ids: string[]): Promise<void> => {
  if (!isNativePlatform()) return;

  await PushNotifications.removeDeliveredNotifications({
    notifications: ids.map((id) => ({ id, tag: '', data: {} }))
  });
};

export const removeAllDeliveredNotifications = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  await PushNotifications.removeAllDeliveredNotifications();
};
