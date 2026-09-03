
const fs = require('fs');
let code = fs.readFileSync('app/components/ui/CustomSelect.vue', 'utf8');
code = code.replace(import { ref, computed, nextTick, watch } from 'vue', import { ref, computed, nextTick, watch, onUnmounted } from 'vue');
code += \nif (typeof window !== 'undefined') {
  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
}\n;
fs.writeFileSync('app/components/ui/CustomSelect.vue', code);

