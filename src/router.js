import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from './github/token'
import Home from './views/Home.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./components/Preferences.vue'),
    },
    {
      path: '/',
      name: 'repos',
      component: () => import('./views/Repositories.vue'),
    },
    {
      path: '/:owner/:repo',
      name: 'home',
      component: Home,
      // the trend and audience cards sit side by side on wide screens
      meta: { wide: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'settings' && !getToken()) {
    return { name: 'settings', query: { redirect: to.fullPath } }
  }
})

export default router
