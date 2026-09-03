const fs = require('fs')
let layout = fs.readFileSync('app/layouts/dashboard.vue', 'utf8')
layout = layout.replace('p-6', 'p-4 md:p-6')
fs.writeFileSync('app/layouts/dashboard.vue', layout)
