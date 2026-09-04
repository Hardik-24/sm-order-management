import { ref } from 'vue'

const snackbarMessage = ref('')
const snackbarType = ref('success') // 'success' | 'loading' | 'error'
const isVisible = ref(false)

export function useSnackbar() {
  const showSaving = (msg: string) => {
    snackbarMessage.value = msg
    snackbarType.value = 'loading'
    isVisible.value = true
  }

  const showSaved = (msg: string) => {
    snackbarMessage.value = msg
    snackbarType.value = 'success'
    isVisible.value = true
    setTimeout(() => { isVisible.value = false }, 3000)
  }

  const showEditing = (msg: string) => {
    snackbarMessage.value = msg
    snackbarType.value = 'error'
    isVisible.value = true
    setTimeout(() => { isVisible.value = false }, 5000)
  }

  return { showSaving, showSaved, showEditing, snackbarMessage, snackbarType, isVisible }
}
