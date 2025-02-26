import './assets/styles.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { 
  faEdit, 
  faTrash, 
  faSync,
  faUserPlus,
  faSearch,
  faSortAlphaDownAlt,
  faSortAlphaUp
} from '@fortawesome/free-solid-svg-icons'

import App from './App.vue'
import router from './router'

library.add(faEdit, faTrash, faSync, faUserPlus, faSearch, faSortAlphaDownAlt, faSortAlphaUp)

const app = createApp(App)
const pinia = createPinia()

app.component('font-awesome-icon', FontAwesomeIcon)
app.use(pinia)
app.use(router)

app.mount('#app')
