import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../libs/api';
import { isNativePlatform, getPlatform } from '../libs/capacitor';
import {
  initializePushNotifications,
  checkPushPermissions,
  type PushPermissionState,
  type PushNotificationData
} from '../libs/pushNotifications';
import { useAuth } from './useAuth';

type PushDevice = {
  id: string;
  token: string;
  platform: string;
  deviceId?: string;
  deviceName?: string;
  createdAt: string;
};

const registerDeviceToken = async (token: string): Promise<PushDevice> => {
  const platform = getPlatform();
  const response = await api.post('/notifications/devices', {
    token,
    platform,
    device_name: `${platform} device`
  });
  return response.data.data;
};

const revokeDeviceToken = async (token: string): Promise<void> => {
  await api.delete('/notifications/devices', { data: { token } });
};

const fetchDevices = async (): Promise<PushDevice[]> => {
  const response = await api.get('/notifications/devices');
  return response.data.data || [];
};

export const usePushNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [permissionStatus, setPermissionStatus] = useState<PushPermissionState>('prompt');
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const initializedRef = useRef(false);

  const { data: devices = [] } = useQuery({
    queryKey: ['push-devices'],
    queryFn: fetchDevices,
    enabled: isAuthenticated && isNativePlatform()
  });

  const registerMutation = useMutation({
    mutationFn: registerDeviceToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: revokeDeviceToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
      setCurrentToken(null);
    }
  });

  const handleNotificationAction = useCallback((notification: PushNotificationData) => {
    const data = notification.data as Record<string, string>;

    if (data.booking_id) {
      navigate(`/app/bookings/${data.booking_id}`);
    } else if (data.conversation_id) {
      navigate(`/app/messages/${data.conversation_id}`);
    } else if (data.route) {
      navigate(data.route);
    }
  }, [navigate]);

  const initialize = useCallback(async () => {
    if (!isNativePlatform() || !isAuthenticated || initializedRef.current) {
      return;
    }

    setIsInitializing(true);
    initializedRef.current = true;

    try {
      const token = await initializePushNotifications({
        onRegistration: (newToken) => {
          setCurrentToken(newToken);
          registerMutation.mutate(newToken);
        },
        onRegistrationError: (error) => {
          console.error('Push registration failed:', error);
        },
        onNotificationReceived: (notification) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
        onNotificationAction: (notification) => {
          handleNotificationAction(notification);
        }
      });

      if (token) {
        setCurrentToken(token);
        setPermissionStatus('granted');
      }
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [isAuthenticated, handleNotificationAction, registerMutation, queryClient]);

  useEffect(() => {
    if (!isNativePlatform()) return;

    checkPushPermissions().then(setPermissionStatus);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isNativePlatform() && permissionStatus !== 'denied') {
      initialize();
    }
  }, [isAuthenticated, permissionStatus, initialize]);

  useEffect(() => {
    if (!isAuthenticated && currentToken) {
      revokeMutation.mutate(currentToken);
      initializedRef.current = false;
    }
  }, [isAuthenticated, currentToken, revokeMutation]);

  const requestPermission = useCallback(async () => {
    if (!isNativePlatform()) return false;

    await initialize();
    const status = await checkPushPermissions();
    setPermissionStatus(status);
    return status === 'granted';
  }, [initialize]);

  return {
    isSupported: isNativePlatform(),
    permissionStatus,
    isInitializing,
    currentToken,
    devices,
    requestPermission,
    revokeToken: (token: string) => revokeMutation.mutateAsync(token)
  };
};

export type UsePushNotificationsReturn = ReturnType<typeof usePushNotifications>;
