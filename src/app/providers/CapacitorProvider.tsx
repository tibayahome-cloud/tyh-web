import { useEffect, type ReactNode } from 'react';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

import { isNativePlatform, isAndroid } from '../../shared/libs/capacitor';

type Props = {
  children: ReactNode;
};

let initialized = false;

const initializeCapacitor = async () => {
  if (initialized || !isNativePlatform()) return;
  initialized = true;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch {
    // Status bar may not be available
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
    // Splash screen may already be hidden
  }

  App.addListener('appStateChange', ({ isActive }) => {
    document.dispatchEvent(new CustomEvent(isActive ? 'app:resume' : 'app:pause'));
  });
};

export const CapacitorInit = ({ children }: Props) => {
  useEffect(() => {
    initializeCapacitor();
  }, []);

  return <>{children}</>;
};

export const useCapacitorBackButton = (onBack: () => void, canGoBack: boolean) => {
  useEffect(() => {
    if (!isNativePlatform()) return;

    const listener = App.addListener('backButton', () => {
      if (canGoBack) {
        onBack();
      } else {
        App.exitApp();
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [onBack, canGoBack]);
};

export const useCapacitorDeepLink = (onUrl: (path: string) => void) => {
  useEffect(() => {
    if (!isNativePlatform()) return;

    const listener = App.addListener('appUrlOpen', ({ url }) => {
      try {
        const path = new URL(url).pathname;
        if (path) onUrl(path);
      } catch {
        // Invalid URL
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [onUrl]);
};
