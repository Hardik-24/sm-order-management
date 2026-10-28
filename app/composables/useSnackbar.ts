import { ref, computed } from 'vue'

export type SnackbarState = 'hidden' | 'editing' | 'saving' | 'saved' | 'error'

const snackbarState = ref<SnackbarState>('hidden')
const snackbarMessage = ref('')
const onSaveAction = ref<(() => void) | null>(null)
const onCancelAction = ref<(() => void) | null>(null)

let autoHideTimer: any = null

export const useSnackbar = () => {
  const showEditing = (msg = 'Unsaved changes', onSave?: () => void, onCancel?: () => void, autoHideMs = 4000) => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    snackbarState.value = 'editing'
    snackbarMessage.value = msg
    onSaveAction.value = onSave || null
    onCancelAction.value = onCancel || null

    // If informational without action buttons, auto-hide smoothly
    if (!onSave) {
      autoHideTimer = setTimeout(() => {
        if (snackbarState.value === 'editing' && !onSaveAction.value) {
          snackbarState.value = 'hidden'
        }
      }, autoHideMs)
    }
  }

  const showSaving = (msg = 'Saving...') => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    snackbarState.value = 'saving'
    snackbarMessage.value = msg
    onSaveAction.value = null
    onCancelAction.value = null
  }

  const showSaved = (msg = 'Changes saved successfully') => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    snackbarState.value = 'saved'
    snackbarMessage.value = msg
    onSaveAction.value = null
    onCancelAction.value = null
    autoHideTimer = setTimeout(() => {
      if (snackbarState.value === 'saved') {
        snackbarState.value = 'hidden'
      }
    }, 3500)
  }

  const showError = (msg = 'An error occurred', autoHideMs = 4500) => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    snackbarState.value = 'error'
    snackbarMessage.value = msg
    onSaveAction.value = null
    onCancelAction.value = null
    autoHideTimer = setTimeout(() => {
      if (snackbarState.value === 'error') {
        snackbarState.value = 'hidden'
      }
    }, autoHideMs)
  }

  const showSuccess = (msg = 'Changes saved successfully') => {
    showSaved(msg)
  }

  const showSnackbar = (msg: string, type: 'success' | 'error' | 'saving' | 'info' = 'success') => {
    if (type === 'success') {
      showSaved(msg)
    } else if (type === 'error') {
      showError(msg)
    } else if (type === 'saving') {
      showSaving(msg)
    } else {
      showEditing(msg)
    }
  }

  const hide = () => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    snackbarState.value = 'hidden'
    onSaveAction.value = null
    onCancelAction.value = null
  }

  const handleSave = () => {
    if (onSaveAction.value) onSaveAction.value()
  }

  const handleCancel = () => {
    if (onCancelAction.value) onCancelAction.value()
    else hide()
  }

  return {
    snackbarState,
    snackbarMessage,
    hasActions: computed(() => !!onSaveAction.value),
    showEditing,
    showSaving,
    showSaved,
    showError,
    showSuccess,
    showSnackbar,
    hide,
    handleSave,
    handleCancel
  }
}
