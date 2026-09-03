const fs = require('fs')

let sidebar = fs.readFileSync('app/components/dashboard/DashboardSidebar.vue', 'utf8')

sidebar = sidebar.replace('<PanelTop v-if="!isMobileMenuOpen" class="w-5 h-5" />', '<Menu v-if="!isMobileMenuOpen" class="w-5 h-5" />')
sidebar = sidebar.replace('<PanelTopClose v-else class="w-5 h-5" />', '<X v-else class="w-5 h-5" />')

if (!sidebar.includes('Menu,')) {
  sidebar = sidebar.replace('PanelTopClose,', 'PanelTopClose,\n  Menu,\n  X,')
}

fs.writeFileSync('app/components/dashboard/DashboardSidebar.vue', sidebar)
