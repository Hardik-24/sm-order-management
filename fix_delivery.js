
const fs = require('fs');
let code = fs.readFileSync('app/components/dashboard/DeliveryTable.vue', 'utf8');
code = code.replace(/import \{ formatCurrency, formatTime, getDisplayStatus, getOverallColor, getStatusColor \} from '~~\\/app\\/lib\\/utils'\\nimport CustomSelect from '~\\/components\\/ui\\/CustomSelect.vue'\\nimport StatusBadge from '~\\/components\\/ui\\/StatusBadge.vue'\\nimport \{ formatDate \} from '~~\\/app\\/lib\\/utils'/, 
\import { formatCurrency, formatTime, getDisplayStatus, getOverallColor, getStatusColor, formatDate } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'\);
fs.writeFileSync('app/components/dashboard/DeliveryTable.vue', code);

