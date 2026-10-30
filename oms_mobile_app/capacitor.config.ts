import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siliconmarketing.oms',
  appName: 'SM Flow',
  webDir: 'dist',
  server: {
    url: 'https://sm-order-management.vercel.app',
    errorPath: 'offline.html',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'sm-order-management.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      '*'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
      backgroundColor: '#1c1c1c',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSplashResourceName: 'splash'
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false
    }
  }
};

export default config;
