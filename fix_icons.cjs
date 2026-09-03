const fs = require('fs')

let sidebar = fs.readFileSync('app/components/dashboard/DashboardSidebar.vue', 'utf8')

// Fix desktop
sidebar = sidebar.replace('<PanelLeft v-if="isSidebarCollapsed" class="w-5 h-5" />\n        <PanelTopClose v-else class="w-5 h-5" />', '<PanelLeft v-if="isSidebarCollapsed" class="w-5 h-5" />\n        <PanelLeftClose v-else class="w-5 h-5" />')

// Fix mobile
sidebar = sidebar.replace('<PanelTop v-if="!isMobileMenuOpen" class="w-5 h-5" />\n        <PanelLeftClose v-else class="w-5 h-5" />', '<PanelTop v-if="!isMobileMenuOpen" class="w-5 h-5" />\n        <PanelTopClose v-else class="w-5 h-5" />')

fs.writeFileSync('app/components/dashboard/DashboardSidebar.vue', sidebar)
