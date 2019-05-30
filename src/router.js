import Vue from 'vue'
import Router from 'vue-router'
import v3 from '@/github/api/v3'

Vue.use(Router)

export default new Router({
  routes: [
    {
        path: '/settings',
        component: () => import('./components/Preferences.vue')
    },
    {
        path: '*',
        component: () => import('./views/Home.vue'),
        props: (route) => ({ route }),
        beforeEnter: (to, from, next) => {
            if (!localStorage.token) {
                console.log('Token not found...');
                next('/settings');
            } else {
                const valid = v3.isValidToken(localStorage.token);
                if (valid) {
                    next();
                } else {
                    next('/settings');
                }
            }
        },
    },
  ]
})
