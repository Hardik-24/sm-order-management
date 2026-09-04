const fs = require('fs');
let code = fs.readFileSync('fleet_mobile_app/src/components/Dashboard.vue', 'utf8');

// Remove Nuxt specific tags
code = code.replace(/<NuxtLayout name="driver">/, '<div>');
code = code.replace(/<\/NuxtLayout>/, '</div>');
code = code.replace(/definePageMeta\([\s\S]*?\)/, '');

// Strip map component to avoid leaflet dependencies for now
code = code.replace(/<LiveTrackingMap[\s\S]*?\/>/, '<div class="p-8 text-center text-gray-500 bg-gray-100 rounded-lg">Map View Hidden in Prototype</div>');
code = code.replace(/import LiveTrackingMap from '~\/components\/LiveTrackingMap\.vue'/, '');

// Add explicit Vue imports if missing (Nuxt auto-imports them)
// It already has import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// Inject API_URL and Token logic at the top of the script setup
const setupStart = '<script setup lang="ts">';
const injectStr = `
import { Preferences } from '@capacitor/preferences';
const API_URL = 'https://sm-order-management.vercel.app';

const fetchAuth = async (url, options = {}) => {
  const { value: token } = await Preferences.get({ key: 'auth_token' });
  const res = await fetch(API_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': \`Bearer \${token}\` } : {}),
      ...options.headers
    }
  });
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

const logout = async () => {
  await Preferences.remove({ key: 'auth_token' });
  window.location.reload();
};
`;
code = code.replace(setupStart, setupStart + injectStr);

// Replace all $fetch calls with fetchAuth
code = code.replace(/\$fetch<.*?>\('\/api/g, "fetchAuth('/api");
code = code.replace(/\$fetch\('\/api/g, "fetchAuth('/api");

// Remove useAuth and fetchUser (we use Preferences now)
code = code.replace(/const \{ user, logout, fetchUser \} = useAuth\(\)/, '');
code = code.replace(/if \(!user\.value\) \{[\s\S]*?fetchUser\(\)[\s\S]*?\}/, '');
code = code.replace(/user\.value/g, "({ name: 'Driver' })"); // mock user name for UI

// Strip Supabase realtime for the standalone prototype (fallback to polling)
code = code.replace(/const config = useRuntimeConfig\(\)[\s\S]*?import\('@supabase\/supabase-js'\)[\s\S]*?\}\)[\s\S]*?\} else \{/m, '');
// Clean up the stray closing brace from the stripped else block
code = code.replace(/autoPollTimer = setInterval\(performDriverPoll, 6000\)[\s\n]*\}/, 'autoPollTimer = setInterval(performDriverPoll, 6000)');

// Remove navigateTo
code = code.replace(/navigateTo\('\/login'\)/, 'window.location.reload()');

fs.writeFileSync('fleet_mobile_app/src/components/Dashboard.vue', code);
console.log('Patched Dashboard.vue successfully!');
