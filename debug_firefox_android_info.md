When debugging a Firefox for Android extension with `web-ext`, `console.log` messages aren't always tagged with the exact extension ID string (like `onlinestore-ch-riskcheck@baweibel.ch`) in the `adb logcat` output. Instead, Firefox generally logs these messages under the `GeckoConsole` tag.

Here are a few ways to find your `console.log` output:

### 1. Grep for `GeckoConsole` in logcat
Instead of filtering by your extension ID, filter by the generic `GeckoConsole` tag that Firefox uses for web extension console logs.

```bash
adb logcat | grep -i "GeckoConsole"
```

If you want to filter out the noise and only see your extension's logs, you can add a unique prefix to your `console.log` statements in your code. For example:
```javascript
console.log("[RiskCheck] Starting check for url: ", url);
```
Then you can grep for that specific prefix:
```bash
adb logcat | grep "RiskCheck"
```

### 2. Use `web-ext` with `--browser-console`
If you are running the extension via `web-ext`, you can pass the `--browser-console` (or `-bc`) flag to automatically open a browser console where the logs will be displayed:

```bash
web-ext run -t firefox-android --adb-device MZ95JJS8EMAUHUV8 --firefox-apk org.mozilla.firefox --browser-console
```

### 3. Use Remote Debugging (`about:debugging`)
The most reliable way to view the console logs for your extension (especially for background service workers) is through Firefox's remote debugging tools on your desktop browser.

1. Connect your Android device via USB and ensure USB debugging is enabled.
2. Open Firefox on your desktop and navigate to `about:debugging`.
3. Click on **Setup** / **Connect** in the left sidebar to connect to your Android device.
4. Once connected, your device will appear in the left menu. Click on it.
5. Under the **Extensions** section, you should see your `OnlineStore CH risk-check` extension.
6. Click the **Inspect** button next to it.
7. This will open the Developer Tools specifically for your extension, where you can see all `console.log` outputs, network requests, and errors in the **Console** tab without needing to parse the noisy `adb logcat` output.