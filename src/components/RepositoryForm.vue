<template>
  <form class="repo-form" role="search" @submit.prevent="onSubmit">
    <label class="field" :class="{ invalid }">
      <span class="prefix">github.com/</span>
      <input
        v-model.trim="value"
        type="text"
        placeholder="owner/repository"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="GitHub repository"
        @input="invalid = false"
      />
      <button type="submit" class="go" :disabled="!value" aria-label="Show star history">
        <Icon name="arrow" :size="16" />
      </button>
    </label>
  </form>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'

const route = useRoute()
const router = useRouter()
const value = ref('')
const invalid = ref(false)

watch(
  () => [route.params.owner, route.params.repo],
  ([owner, repo]) => {
    value.value = owner && repo ? `${owner}/${repo}` : ''
  },
  { immediate: true },
)

// Accepts `owner/repo`, `github.com/owner/repo` or a full URL (with optional `.git` or subpaths).
function parse(input) {
  const path = input
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/^\/+/, '')
  const [owner, repo] = path.split(/[/?#]/)
  return owner && repo ? { owner, repo: repo.replace(/\.git$/, '') } : null
}

function onSubmit() {
  const target = parse(value.value)
  if (!target) {
    invalid.value = true
    return
  }
  const by = route.query.by
  router.push({ name: 'home', params: target, query: by ? { by } : {} })
}
</script>

<style scoped>
.field {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 4px 0 14px;
  border-radius: 11px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  transition: border-color .15s, box-shadow .15s;
  cursor: text;
}
.field:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.field.invalid {
  border-color: var(--danger);
  box-shadow: 0 0 0 4px var(--danger-soft);
}

.prefix {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 13px;
  white-space: nowrap;
  user-select: none;
}

input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  font-family: var(--mono);
  font-size: 13px;
  padding: 0 6px 0 1px;
}
input::placeholder { color: var(--muted); opacity: .6; }

.go {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: var(--text);
  color: var(--bg);
  cursor: pointer;
  transition: opacity .15s;
}
.go:disabled { opacity: .18; cursor: default; }

@media (max-width: 479px) {
  .prefix { display: none; }
  .field { padding-left: 12px; }
}
</style>
