import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tibayahome.app",
  appName: "Tiba Ya Home",
  webDir: "dist",
  android: {
    path: "android"
  },
  server: {
    androidScheme: "https"
  },
  plugins: {
    App: {
      launchUrl: "https://tibayahome.com"
    },
    Browser: {
      presentationStyle: "fullscreen"
    },
    Geolocation: {
      permissionsPrompt: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE"
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff"
    }
  }
};

export default config;
