const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

const markBillGeneratedFn = `
const markBillGenerated = async () => {
  if (!order.value) return
  showSaving()
  try {
    await $fetch(\`/api/orders/\${order.value.id}/billing\`, {
      method: 'PATCH',
      body: { status: 'GENERATED', holdReason: '' }
    })
    showSaved('Bill generated successfully')
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err) {
    console.error(err)
    hide()
  }
}

const updateBilling = async () => {`

file = file.replace(/const updateBilling = async \(\) => \{/, markBillGeneratedFn)

const oldBillingHeader = `<button v-if="!showBillingForm && hasRole('ADMIN', 'BILLING')" @click="initBillingForm" class="text-xs font-medium text-[#1a5c4c] hover:underline">
                    Edit
                  </button>`

const newBillingHeader = `<div class="flex flex-col gap-2 items-end">
                    <button 
                      v-if="hasRole('ADMIN', 'BILLING') && order.billingStatus?.status !== 'GENERATED'" 
                      @click="markBillGenerated" 
                      class="px-3 py-1.5 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 shadow-sm"
                    >
                      Mark as Generated
                    </button>
                    <button v-if="!showBillingForm && hasRole('ADMIN', 'BILLING')" @click="initBillingForm" class="text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:underline">
                      Advanced Edit
                    </button>
                  </div>`

file = file.replace(oldBillingHeader, newBillingHeader)

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
