import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { bootSave } from './game/persistence'

bootSave()
createApp(App).mount('#app')
