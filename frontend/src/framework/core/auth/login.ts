import apiClient from '@shared/lib/axios'

interface LoginUrlResponse {
  loginUrl: string
  state: string
}

export const login = {
  redirect: async (returnTo: string = window.location.pathname) => {
    try {
      const response = await apiClient.get<{ data: LoginUrlResponse }>('/auth/login')
      const { loginUrl } = response.data.data
      if (returnTo && returnTo !== '/login') {
        sessionStorage.setItem('auth_return_to', returnTo)
      }
      window.location.href = loginUrl
    } catch (error) {
      console.error('Failed to get login URL', error)
      throw error
    }
  },

  popup: async (returnTo: string = '/'): Promise<void> => {
    const response = await apiClient.get<{ data: LoginUrlResponse }>('/auth/login')
    const { loginUrl } = response.data.data

    return new Promise((resolve, reject) => {
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      if (returnTo) {
        sessionStorage.setItem('auth_return_to', returnTo)
      }

      const popup = window.open(
        loginUrl,
        'auth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popup) {
        reject(new Error('Popup blocked'))
        return
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          resolve()
        }
      }, 500)
    })
  },
}
