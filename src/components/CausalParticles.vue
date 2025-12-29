<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

// Particle types for different causal flows
export type ParticleType =
  | 'bandwidth-cost'   // Spending bandwidth (flies TO bandwidth bar)
  | 'bandwidth-gain'   // Gaining bandwidth from symlink (flies TO bandwidth bar, green)
  | 'weight-gain'      // Weight increasing (flies TO weight display)
  | 'gravity-pulse';   // Gravity building (flies TO gravity bar)

interface Particle {
  id: number;
  type: ParticleType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  duration: number;
  startTime: number;
}

const particles = ref<Particle[]>([]);
let nextId = 0;
let animationFrameId: number | null = null;

// HUD element positions (will be set by parent or calculated)
const hudPositions = ref<Record<string, { x: number; y: number }>>({
  bandwidth: { x: 80, y: 36 },
  weight: { x: 200, y: 36 },
  gravity: { x: window.innerWidth - 200, y: window.innerHeight - 36 },
});

// Update HUD positions based on actual element locations
function updateHudPositions() {
  // Bandwidth bar
  const bandwidthEl = document.querySelector('.bar-fill.bandwidth');
  if (bandwidthEl) {
    const rect = bandwidthEl.getBoundingClientRect();
    hudPositions.value.bandwidth = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // Weight display
  const weightEl = document.querySelector('.weight-icon');
  if (weightEl) {
    const rect = weightEl.getBoundingClientRect();
    hudPositions.value.weight = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // Gravity bar
  const gravityEl = document.querySelector('.gravity-fill');
  if (gravityEl) {
    const rect = gravityEl.getBoundingClientRect();
    hudPositions.value.gravity = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
}

// Spawn a causal particle
function spawnParticle(type: ParticleType, fromX: number, fromY: number) {
  updateHudPositions();

  let target: { x: number; y: number } | undefined;
  let duration: number;

  switch (type) {
    case 'bandwidth-cost':
      target = hudPositions.value.bandwidth;
      duration = 400;
      break;
    case 'bandwidth-gain':
      // Bandwidth refund from symlink - same target, different color
      target = hudPositions.value.bandwidth;
      duration = 350; // Slightly faster for reward feel
      break;
    case 'weight-gain':
      target = hudPositions.value.weight;
      duration = 500;
      break;
    case 'gravity-pulse':
      target = hudPositions.value.gravity;
      duration = 600;
      break;
    default:
      return;
  }

  if (!target) return;

  const particle: Particle = {
    id: nextId++,
    type,
    startX: fromX,
    startY: fromY,
    endX: target.x,
    endY: target.y,
    progress: 0,
    duration,
    startTime: Date.now(),
  };

  particles.value.push(particle);
}

// Animation loop
function animate() {
  const now = Date.now();

  particles.value = particles.value.filter(p => {
    const elapsed = now - p.startTime;
    p.progress = Math.min(1, elapsed / p.duration);
    return p.progress < 1;
  });

  animationFrameId = requestAnimationFrame(animate);
}

// Calculate particle position with easing
function getParticleStyle(p: Particle) {
  // Ease out cubic for smooth deceleration
  const t = 1 - Math.pow(1 - p.progress, 3);

  const x = p.startX + (p.endX - p.startX) * t;
  const y = p.startY + (p.endY - p.startY) * t;

  // Add slight arc
  const arcHeight = -30 * Math.sin(p.progress * Math.PI);

  return {
    left: `${x}px`,
    top: `${y + arcHeight}px`,
    opacity: 1 - p.progress * 0.5,
    transform: `scale(${1 - p.progress * 0.5})`,
  };
}

// Get particle color based on type
function getParticleClass(type: ParticleType): string {
  switch (type) {
    case 'bandwidth-cost': return 'particle-bandwidth';
    case 'bandwidth-gain': return 'particle-bandwidth-gain';
    case 'weight-gain': return 'particle-weight';
    case 'gravity-pulse': return 'particle-gravity';
    default: return '';
  }
}

// Expose spawn function for external use
defineExpose({ spawnParticle });

onMounted(() => {
  animationFrameId = requestAnimationFrame(animate);
  updateHudPositions();
  window.addEventListener('resize', updateHudPositions);
});

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener('resize', updateHudPositions);
});
</script>

<template>
  <div class="causal-particles">
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :class="getParticleClass(particle.type)"
      :style="getParticleStyle(particle)"
    >
      <span class="particle-icon">
        {{ particle.type === 'bandwidth-cost' ? '↓' :
           particle.type === 'bandwidth-gain' ? '↑' :
           particle.type === 'weight-gain' ? '◆' :
           particle.type === 'gravity-pulse' ? '◉' : '•' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.causal-particles {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  transition: none;
}

.particle-icon {
  text-shadow: 0 0 8px currentColor;
}

.particle-bandwidth {
  color: #7a7aff;
  background: radial-gradient(circle, rgba(122, 122, 255, 0.4) 0%, transparent 70%);
  box-shadow: 0 0 12px rgba(122, 122, 255, 0.6);
}

.particle-bandwidth-gain {
  color: #5aff7a;
  background: radial-gradient(circle, rgba(90, 255, 122, 0.5) 0%, transparent 70%);
  box-shadow: 0 0 16px rgba(90, 255, 122, 0.8);
  animation: particle-pulse 0.2s ease-in-out infinite alternate;
}

.particle-weight {
  color: #ffaa5a;
  background: radial-gradient(circle, rgba(255, 170, 90, 0.4) 0%, transparent 70%);
  box-shadow: 0 0 12px rgba(255, 170, 90, 0.6);
}

.particle-gravity {
  color: #a78bfa;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, transparent 70%);
  box-shadow: 0 0 12px rgba(167, 139, 250, 0.6);
}

@keyframes particle-pulse {
  from { transform: scale(1); }
  to { transform: scale(1.15); }
}
</style>
