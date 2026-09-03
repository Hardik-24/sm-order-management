const fs = require('fs')
const files = [
  'app/pages/dashboard/billing.vue',
  'app/pages/dashboard/packing.vue',
  'app/pages/dashboard/delivery.vue'
]

const oldOverlay = `<div v-if="pending" class="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 pointer-events-none flex flex-col pt-[72px] px-6 gap-6">
        <div v-for="i in 5" :key="i" class="w-full h-8 bg-gray-200/60 rounded animate-pulse"></div>
      </div>`

const newOverlay = `<div v-if="pending" class="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 pointer-events-none animate-pulse transition-all duration-300"></div>`

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  content = content.replace(oldOverlay, newOverlay)
  fs.writeFileSync(file, content)
}
