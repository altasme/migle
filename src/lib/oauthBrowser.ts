import { registerPlugin } from '@capacitor/core'

// Backs onto android/app/src/main/java/com/mingleverse/app/OAuthBrowserPlugin.java.
// @capacitor/browser's Browser.open() launches a Custom Tab with no package
// set, which lets Android's App Link resolution kick in - and Discord's
// Android app is a verified handler for discord.com, so it intercepts the
// OAuth authorize URL and enforces its own account-verification gate
// (unrelated to, and unreachable from, the desktop web OAuth flow). This
// plugin launches the same Custom Tab against an explicit browser package
// instead, which Android can't redirect to another app.
interface OAuthBrowserPlugin {
  open(options: { url: string }): Promise<void>
}

export const OAuthBrowser = registerPlugin<OAuthBrowserPlugin>('OAuthBrowser')
