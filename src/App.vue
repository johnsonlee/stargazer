<template>
  <header class="app-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" aria-label="Stargazer home">
        <span class="brand-mark"><Icon name="star" :size="14" /></span>
        <span class="brand-name">Stargazer</span>
      </RouterLink>
      <RepositoryForm class="header-search" />
      <nav class="header-actions">
        <RouterLink :to="{ name: 'settings', query: { redirect: $route.name === 'settings' ? $route.query.redirect : $route.fullPath } }" class="icon-btn" title="Access token" aria-label="Access token settings">
          <Icon name="settings" :size="18" />
        </RouterLink>
        <a href="https://github.com/johnsonlee/stargazer" class="icon-btn" title="Source on GitHub" aria-label="Source on GitHub">
          <Icon name="github" :size="18" />
        </a>
      </nav>
    </div>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<script setup>
import Icon from './components/Icon.vue'
import RepositoryForm from './components/RepositoryForm.vue'
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--header-bg);
  backdrop-filter: saturate(1.6) blur(14px);
  -webkit-backdrop-filter: saturate(1.6) blur(14px);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #1a1300;
  background: linear-gradient(140deg, #ffd66b, #e9a400);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 4px 14px -4px var(--accent-glow);
}

.header-search { flex: 1; max-width: 460px; margin: 0 auto; }

.header-actions { display: flex; gap: 4px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  color: var(--muted);
  transition: background-color .15s, color .15s;
}
.icon-btn:hover, .icon-btn.router-link-active { color: var(--text); background: var(--surface-2); }

@media (max-width: 639px) {
  .brand-name { display: none; }
  .header-inner { gap: 10px; }
}
</style>
