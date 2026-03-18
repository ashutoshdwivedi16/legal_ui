let _embed = false

export function initEmbedMode(): string | null {
  const params = new URLSearchParams(window.location.search)
  _embed = params.has('embed')

  const token = params.get('token')
  if (_embed && token) {
    window.history.replaceState({}, '', window.location.pathname + '?embed')
    return token
  }
  return null
}

export function isEmbedMode(): boolean {
  return _embed
}
