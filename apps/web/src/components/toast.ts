let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast toast-${type} toast-show`;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast!.classList.remove('toast-show');
  }, 3000);
}
