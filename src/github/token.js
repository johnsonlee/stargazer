// Kept under the same localStorage key as earlier versions so saved tokens survive upgrades.
const KEY = 'token'

export function getToken() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable (private mode); token lives for this page only
  }
}
