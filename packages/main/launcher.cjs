const { app } = require('electron');

// Electron ≥36 auto-selects the Wayland backend on Wayland sessions, which
// segfaults on this machine at BrowserWindow creation. The backend can only be
// forced via the real command line (appendSwitch/env are read too late), so
// "npm start" passes --ozone-platform=x11 and this guard relaunches with the
// flag when the app was started some other way.
if (!process.argv.some((arg) => arg.startsWith('--ozone-platform'))) {
  app.relaunch({ args: process.argv.slice(1).concat(['--ozone-platform=x11']) });
  app.exit(0);
} else {
  (async () => {
    try {
      await import('./dist/mainBackend.js');
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
