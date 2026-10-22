import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siliconmarketing.oms',
  appName: 'Silicon OMS',
  webDir: 'dist',
  server: {
    // Local offline error handler (prevents Chromium Dino page)
    errorPath: 'offline.html',
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1c1c1c',
      showSpinner: false,
      androidSplashResourceName: 'splash'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1c1c1c',
      overlaysWebView: false
    }
  }
};

export default config;
