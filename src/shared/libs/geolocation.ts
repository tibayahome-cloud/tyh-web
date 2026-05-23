import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { isNativePlatform } from './capacitor';

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeoPermissionState = 'granted' | 'denied' | 'prompt';

const toGeoPosition = (position: Position | GeolocationPosition): GeoPosition => {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp
  };
};

export const checkPermissions = async (): Promise<GeoPermissionState> => {
  if (isNativePlatform()) {
    const status: PermissionStatus = await Geolocation.checkPermissions();
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return 'granted';
    }
    if (status.location === 'denied') {
      return 'denied';
    }
    return 'prompt';
  }

  if (!navigator.permissions?.query) {
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return result.state as GeoPermissionState;
  } catch {
    return 'prompt';
  }
};

export const requestPermissions = async (): Promise<GeoPermissionState> => {
  if (isNativePlatform()) {
    const status = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return 'granted';
    }
    return status.location === 'denied' ? 'denied' : 'prompt';
  }

  return checkPermissions();
};

export const getCurrentPosition = async (highAccuracy = false): Promise<GeoPosition> => {
  if (isNativePlatform()) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: highAccuracy,
      timeout: 15000,
      maximumAge: highAccuracy ? 0 : 60000
    });
    return toGeoPosition(position);
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toGeoPosition(position)),
      (error) => reject(error),
      {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: highAccuracy ? 0 : 60000
      }
    );
  });
};

export type WatchCallback = (position: GeoPosition) => void;
export type WatchErrorCallback = (error: Error) => void;

let watchId: string | number | null = null;

export const watchPosition = async (
  onPosition: WatchCallback,
  onError?: WatchErrorCallback,
  highAccuracy = true
): Promise<void> => {
  if (isNativePlatform()) {
    watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: 0
      },
      (position, err) => {
        if (err) {
          onError?.(new Error(err.message));
          return;
        }
        if (position) {
          onPosition(toGeoPosition(position));
        }
      }
    );
    return;
  }

  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation is not supported'));
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => onPosition(toGeoPosition(position)),
    (error) => onError?.(error),
    {
      enableHighAccuracy: highAccuracy,
      timeout: 15000,
      maximumAge: 0
    }
  );
};

export const clearWatch = async (): Promise<void> => {
  if (watchId === null) return;

  if (isNativePlatform()) {
    await Geolocation.clearWatch({ id: watchId as string });
  } else if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId as number);
  }

  watchId = null;
};
