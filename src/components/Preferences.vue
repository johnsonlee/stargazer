<template>
  <section class="container settings">
    <form class="card panel" @submit.prevent="onApply">
      <div class="panel-icon"><Icon name="github" :size="22" /></div>
      <h1>Connect to GitHub</h1>
      <p class="lede">
        Stargazer reads star timestamps from the GitHub API. A personal access token lifts the
        rate limit to 5,000 requests an hour. It is stored only in this browser.
      </p>

      <p v-if="route.query.error === 'unauthorized'" class="notice">
        GitHub rejected the saved token. Paste a new one to continue.
      </p>

      <label class="label" for="token">Access token</label>
      <input
        id="token"
        v-model.trim="token"
        class="input"
        :class="{ invalid: error }"
        type="password"
        placeholder="ghp_… or github_pat_…"
        autocomplete="off"
        spellcheck="false"
        @input="error = ''"
      />
      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="!token || checking">
          {{ checking ? 'Verifying…' : 'Save token' }}
        </button>
        <a class="btn btn-ghost" :href="GENERATE_URL" target="_blank" rel="noopener">
          Generate a token <Icon name="external" :size="14" />
        </a>
      </div>

      <button v-if="saved" type="button" class="remove" @click="onRemove">Remove saved token</button>
    </form>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import { getToken, setToken } from '../github/token'
import { fetchRateLimit, GitHubError } from '../github/api/v3'

const GENERATE_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=stargazer'

const route = useRoute()
const router = useRouter()
const token = ref(getToken())
const saved = ref(Boolean(getToken()))
const checking = ref(false)
const error = ref('')

async function onApply() {
  checking.value = true
  error.value = ''
  try {
    await fetchRateLimit(token.value)
    setToken(token.value)
    const redirect = route.query.redirect
    router.replace(typeof redirect === 'string' && !redirect.startsWith('/settings') ? redirect : '/')
  } catch (e) {
    error.value = e instanceof GitHubError && e.status === 401
      ? 'GitHub doesn’t recognise this token.'
      : 'Couldn’t reach GitHub. Check your connection and try again.'
  } finally {
    checking.value = false
  }
}

function onRemove() {
  setToken('')
  token.value = ''
  saved.value = false
}
</script>

<style scoped>
.settings {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 64px);
  padding-top: 32px;
  padding-bottom: 64px;
}

.panel {
  width: 100%;
  max-width: 460px;
  padding: 32px;
}

.panel-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  margin-bottom: 20px;
}

h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.lede {
  margin: 0 0 24px;
  color: var(--text-2);
  text-wrap: pretty;
}

.notice {
  margin: 0 0 20px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 14px;
}

.label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
  font-family: var(--mono);
  font-size: 13px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }
.input.invalid { border-color: var(--danger); box-shadow: 0 0 0 4px var(--danger-soft); }

.error { margin: 8px 0 0; font-size: 13px; color: var(--danger); }

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.remove {
  margin-top: 20px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 13px;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.remove:hover { color: var(--danger); }

@media (max-width: 479px) {
  .panel { padding: 24px 20px; }
  .actions .btn { flex: 1; }
}
</style>
