<script setup lang="ts">
import { ref, provide } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import HUD from './components/HUD.vue';
import UpgradePanel from './components/UpgradePanel.vue';
import CausalParticles from './components/CausalParticles.vue';
import type { ParticleType } from './components/CausalParticles.vue';

// Particle system ref
const particleSystem = ref<InstanceType<typeof CausalParticles> | null>(null);

// Function to spawn causal particles (provided to child components)
function spawnCausalParticle(type: ParticleType, fromX: number, fromY: number) {
  particleSystem.value?.spawnParticle(type, fromX, fromY);
}

// Provide the spawn function to all children
provide('spawnCausalParticle', spawnCausalParticle);
</script>

<template>
  <div class="app">
    <GameCanvas />
    <HUD />
    <UpgradePanel />
    <CausalParticles ref="particleSystem" />
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
