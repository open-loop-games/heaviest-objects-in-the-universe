import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { bootSave } from './game/persistence'

bootSave()
createApp(App).mount('#app')

// The calibration recorder exists only in dev builds; the import is dropped from production.
if (import.meta.env.DEV) {
  void import('./game/recorder').then((m) => m.startRecorder())
}
