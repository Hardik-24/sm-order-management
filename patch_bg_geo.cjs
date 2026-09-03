const fs = require('fs');
let code = fs.readFileSync('app/pages/driver/index.vue', 'utf8');

const imports = `import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation as CapGeolocation } from '@capacitor/geolocation'
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')

const geo = {
  watchPosition: async (success, error, options) => {
    if (Capacitor.isNativePlatform()) {
      // Use the hardcore Background Geolocation plugin
      return await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Tracking active. Tap to open app.",
          backgroundTitle: "SM Fleet",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10
        },
        (location, err) => {
          if (err) {
            error(err)
            return
          }
          if (location) {
            // Map plugin output to match HTML5 Geolocation API exactly
            success({
              coords: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.bearing
              },
              timestamp: location.time
            })
          }
        }
      )
    } else {
      return window.navigator.geolocation.watchPosition(success, error, options)
    }
  },
  clearWatch: async (id) => {
    if (Capacitor.isNativePlatform()) {
      await BackgroundGeolocation.removeWatcher({ id })
    } else {
      window.navigator.geolocation.clearWatch(id)
    }
  },
  getCurrentPosition: async (success, error, options) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const pos = await CapGeolocation.getCurrentPosition(options)
        success(pos)
      } catch (e) {
        if (error) error(e)
      }
    } else {
      window.navigator.geolocation.getCurrentPosition(success, error, options)
    }
  }
}
`;

// Regex replace the entire old geo block.
// The old block starts with "import { Capacitor } from '@capacitor/core'" and ends before "import { \n  Truck"
const regex = /import \{ Capacitor \} from '@capacitor\/core'[\s\S]*?\}\n\}/m;

code = code.replace(regex, imports.trim());

fs.writeFileSync('app/pages/driver/index.vue', code);
console.log('Done');
