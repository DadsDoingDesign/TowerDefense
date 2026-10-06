import type { CapacitorConfig } from '@capacitor/cli'

// The iOS app wraps the same Vite build the web serves (`dist/`).
// `appId` is permanent once the app exists in App Store Connect.
const config: CapacitorConfig = {
  appId: 'com.dadsdoingdesign.merchantmercenaries',
  appName: 'Merchant Mercenaries',
  webDir: 'dist',
  backgroundColor: '#201711',
  ios: {
    // The page already pads itself with the safe-area insets (shell.css).
    contentInset: 'never',
    // No rubber-band bounce: the game is a fixed screen, not a page.
    scrollEnabled: false,
    backgroundColor: '#201711',
  },
  plugins: {
    // Light status-bar text over the dark ground.
    StatusBar: {
      style: 'DARK',
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#201711',
    },
  },
}

export default config
