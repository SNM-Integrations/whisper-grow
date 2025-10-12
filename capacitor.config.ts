import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.eed02dece8b24e5ea52f9a4de393a610',
  appName: 'whisper-grow',
  webDir: 'dist',
  server: {
    url: 'https://eed02dec-e8b2-4e5e-a52f-9a4de393a610.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
