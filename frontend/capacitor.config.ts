import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zippygo.app',
  appName: 'ZIPPYGO',
  webDir: 'build',
  server: {
    url: 'https://zippygo-app.onrender.com',
    cleartext: false
  }
};

export default config;
