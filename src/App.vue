<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue';
import HUD from './components/HUD.vue';
import UpgradePanel from './components/UpgradePanel.vue';
</script>

<template>
  <div class="app">
    <GameCanvas />
    <HUD />
    <UpgradePanel />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0a0f;
}

#app {
  width: 100%;
  height: 100%;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
