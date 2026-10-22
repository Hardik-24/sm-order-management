import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siliconmarketing.oms',
  appName: 'Silicon OMS',
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
