const fs = require('fs')

// 1. Update DashboardTopbar.vue
let topbar = fs.readFileSync('app/components/dashboard/DashboardTopbar.vue', 'utf8')
if (!topbar.includes('Menu class=')) {
  topbar = topbar.replace('<div class="flex items-center gap-4">', `<div class="flex items-center gap-4">
      <!-- Hamburger Menu (Mobile Only) -->
      <button @click="isMobileMenuOpen = true" class="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
        <Menu class="w-5 h-5" />
      </button>
`)
  topbar = topbar.replace(/import \{ Search, Bell \} from 'lucide-vue-next'/, `import { Search, Bell, Menu } from 'lucide-vue-next'`)
  topbar = topbar.replace(/const isSidebarCollapsed = useState\('sidebarCollapsed', \(\) => false\)/, `const isSidebarCollapsed = useState('sidebarCollapsed', () => false)\nconst isMobileMenuOpen = useState('mobileMenuOpen', () => false)`)
  fs.writeFileSync('app/components/dashboard/DashboardTopbar.vue', topbar)
}

// 2. Update DashboardSidebar.vue
let sidebar = fs.readFileSync('app/components/dashboard/DashboardSidebar.vue', 'utf8')
if (!sidebar.includes('isMobileMenuOpen = false')) {
  // Add mobile overlay
  sidebar = sidebar.replace('<template>', `<template>
  <!-- Mobile Overlay -->
  <div 
    v-if="isMobileMenuOpen" 
    class="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
    @click="isMobileMenuOpen = false"
  ></div>`)
  
  // Update aside classes
  sidebar = sidebar.replace(
    /<aside\s+class="flex h-full flex-col bg-\[#141414\] transition-all duration-300 ease-in-out border-r border-gray-800 relative z-20"\s+:class="isSidebarCollapsed \? 'w-20' : 'w-64'">/,
    `<aside 
    class="flex h-full flex-col bg-[#141414] transition-all duration-300 ease-in-out border-r border-gray-800 fixed md:relative z-50 md:z-20"
    :class="[
      isSidebarCollapsed ? 'w-20' : 'w-64',
      isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    ]"
  >`
  )
  
  // Close mobile menu on route change
  sidebar = sidebar.replace(/const isSidebarCollapsed = useState\('sidebarCollapsed', \(\) => false\)/, `const isSidebarCollapsed = useState('sidebarCollapsed', () => false)\nconst isMobileMenuOpen = useState('mobileMenuOpen', () => false)\n\nwatch(() => route.path, () => {\n  isMobileMenuOpen.value = false\n})`)
  
  // Import watch
  if (!sidebar.includes('import { watch }')) {
    sidebar = sidebar.replace(/import \{ useRoute \} from 'vue-router'/, `import { useRoute } from 'vue-router'\nimport { watch } from 'vue'`)
  }
  
  fs.writeFileSync('app/components/dashboard/DashboardSidebar.vue', sidebar)
}

// 3. Update OrderDetailPanel.vue (Mobile 100% width)
let panel = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')
if (panel.includes('max-w-[450px] w-full')) {
  panel = panel.replace(/max-w-\[450px\] w-full/g, 'max-w-full sm:max-w-[450px] w-full')
  fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', panel)
}
