import Vue from 'vue'
import VueLodash from 'vue-lodash'
import VCharts from 'v-charts'
import App from './App.vue'
import router from './router'

Vue.use(VCharts)
Vue.use(VueLodash, { name: 'lodash' })
Vue.config.productionTip = false

new Vue({
  render: h => h(App),
  router
}).$mount('#app')
