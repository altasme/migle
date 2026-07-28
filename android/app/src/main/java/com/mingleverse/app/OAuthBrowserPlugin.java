package com.mingleverse.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

// Discord's Android app registers itself as a verified App Link handler for
// discord.com. A plain Custom Tabs / ACTION_VIEW intent to Discord's OAuth
// authorize URL is just an implicit intent, so Android hands it to the
// installed Discord app instead of a browser whenever Discord is present -
// and the native app enforces its own account-verification gate there,
// which a plain browser tab (and the desktop OAuth flow) never triggers.
// An intent with an explicit package set bypasses App Link disambiguation
// entirely, so this plugin resolves a real browser package and launches the
// Custom Tab against it directly.
@CapacitorPlugin(name = "OAuthBrowser")
public class OAuthBrowserPlugin extends Plugin {

    // Checked in preference order; whichever is both installed and able to
    // handle a bare http:// intent wins. Discord never matches this query -
    // it only declares intent-filters for specific hosts (discord.com), not
    // for the http/https scheme generically - so it can't be picked here.
    private static final String[] PREFERRED_BROWSERS = {
        "com.android.chrome",
        "com.sec.android.app.sbrowser",
        "org.mozilla.firefox",
    };

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("Missing url");
            return;
        }

        CustomTabsIntent tabsIntent = new CustomTabsIntent.Builder().build();
        String browserPackage = resolveBrowserPackage();
        if (browserPackage != null) {
            tabsIntent.intent.setPackage(browserPackage);
        }
        tabsIntent.launchUrl(getContext(), Uri.parse(url));
        call.resolve();
    }

    private String resolveBrowserPackage() {
        PackageManager pm = getContext().getPackageManager();
        Intent genericBrowserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("http://"));
        List<ResolveInfo> candidates = pm.queryIntentActivities(genericBrowserIntent, PackageManager.MATCH_DEFAULT_ONLY);

        for (String preferred : PREFERRED_BROWSERS) {
            for (ResolveInfo info : candidates) {
                if (preferred.equals(info.activityInfo.packageName)) {
                    return preferred;
                }
            }
        }

        // Fall back to the device's actual default browser for a generic
        // http:// link - still excludes Discord for the same reason as
        // above, it just isn't in our preferred list.
        ResolveInfo defaultBrowser = pm.resolveActivity(genericBrowserIntent, PackageManager.MATCH_DEFAULT_ONLY);
        return defaultBrowser != null ? defaultBrowser.activityInfo.packageName : null;
    }
}
