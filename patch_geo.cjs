const fs = require('fs');
let code = fs.readFileSync('app/pages/driver/index.vue', 'utf8');

const imports = `import { Capacitor } from '@capacitor/core'
import { Geolocation as CapGeolocation } from '@capacitor/geolocation'

const geo = {
  watchPosition: async (success, error, options) => {
    if (Capacitor.isNativePlatform()) {
      return await CapGeolocation.watchPosition(options, (pos, err) => {
        if (err) error(err)
        else if (pos) success(pos)
      })
    } else {
      return window.navigator.geolocation.watchPosition(success, error, options)
    }
  },
  clearWatch: async (id) => {
    if (Capacitor.isNativePlatform()) {
      await CapGeolocation.clearWatch({ id })
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

code = code.replace("import { ref, computed, onMounted, onBeforeUnmount } from 'vue'", "import { ref, computed, onMounted, onBeforeUnmount } from 'vue'\n" + imports);
code = code.replace(/if \(!navigator\.geolocation\)/g, 'if (!window.navigator.geolocation && !Capacitor.isNativePlatform())');

// Use lookbehind or just string replacements carefully.
// By changing `navigator.geolocation` to `window.navigator.geolocation` in our wrapper, the regex below won't touch it.

code = code.replace(/navigator\.geolocation\.watchPosition\(/g, 'await geo.watchPosition(');
code = code.replace(/navigator\.geolocation\.clearWatch\(/g, 'geo.clearWatch(');
code = code.replace(/navigator\.geolocation\.getCurrentPosition\(/g, 'geo.getCurrentPosition(');

fs.writeFileSync('app/pages/driver/index.vue', code);
console.log('Done');
