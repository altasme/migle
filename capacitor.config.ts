import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mingleverse.app',
  appName: 'Mingleverse',
  webDir: 'dist',
  plugins: {
    // Only Google sign-in is wired up right now - disabling the rest keeps
    // their native SDKs out of the APK entirely.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
}

export default config
