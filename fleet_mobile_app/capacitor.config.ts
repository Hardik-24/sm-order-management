import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siliconmarketing.fleet',
  appName: 'SM Fleet',
  webDir: 'dist',
  server: {
    url: 'https://sm-order-management.vercel.app',
    cleartext: true
  }
};

export default config;
