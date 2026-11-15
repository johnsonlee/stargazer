import { ref, watch } from 'vue'

// Pinned repositories (full names, in pin order), remembered per browser.
const KEY = 'pins'

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value.filter((it) => typeof it === 'string') : []
  } catch {
    return []
  }
}

export const pins = ref(read())

watch(pins, (value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode); pins last for this page only
  }
}, { deep: true })

export function isPinned(fullName) {
  return pins.value.includes(fullName)
}

export function togglePin(fullName) {
  pins.value = isPinned(fullName)
    ? pins.value.filter((it) => it !== fullName)
    : [...pins.value, fullName]
}
