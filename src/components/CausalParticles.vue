<script setup lang="ts">
import { ref, shallowRef, triggerRef, onMounted, onUnmounted } from 'vue'

// Particle types for different causal flows
export type ParticleType =
  | 'bandwidth-cost' // Spending bandwidth (flies TO bandwidth bar)
  | 'bandwidth-gain' // Gaining bandwidth from symlink (flies TO bandwidth bar, green)
  | 'weight-gain' // Weight increasing (flies TO weight display)
  | 'weight-loss' // Weight decreasing from merge/prune (flies FROM weight, fades)
  | 'gravity-pulse' // Gravity building (flies TO gravity bar)
  | 'efficiency-up' // Efficiency improving (merge success - flies TO efficiency bar, cyan)
  | 'efficiency-down' // Efficiency dropping (duplicate detected - red/orange warning)
  | 'stability-up' // Stability improving (conflict resolved - flies TO stability bar, green)
  | 'stability-down' // Stability dropping (conflict appeared - red warning)
  | 'fragment-collect' // Cache fragment collected (flies TO prestige panel fragment area)

interface Particle {
  id: number
  type: ParticleType
  startX: number
  startY: number
  endX: number
  endY: number
  progress: number
  duration: number
  startTime: number
}

// Use shallowRef to avoid deep reactivity on particle objects
const particles = shallowRef<Particle[]>([])
let nextId = 0
let animationFrameId: number | null = null

// HUD element positions (will be set by parent or calculated)
const hudPositions = ref<Record<string, { x: number; y: number }>>({
  bandwidth: { x: 80, y: 36 },
  weight: { x: 200, y: 36 },
  gravity: { x: window.innerWidth - 200, y: window.innerHeight - 36 },
  efficiency: { x: 220, y: 60 },
  stability: { x: 320, y: 60 },
  fragment: { x: window.innerWidth - 100, y: 36 },
})

// Update HUD positions based on actual element locations
function updateHudPositions() {
  // Bandwidth bar
  const bandwidthEl = document.querySelector('.bar-fill.bandwidth')
  if (bandwidthEl) {
    const rect = bandwidthEl.getBoundingClientRect()
    hudPositions.value.bandwidth = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // Weight display
  const weightEl = document.querySelector('.weight-icon')
  if (weightEl) {
    const rect = weightEl.getBoundingClientRect()
    hudPositions.value.weight = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // Gravity / prestige area (singularity)
  const gravityEl = document.querySelector('.singularity')
  if (gravityEl) {
    const rect = gravityEl.getBoundingClientRect()
    hudPositions.value.gravity = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // Efficiency bar (quality metrics)
  const efficiencyEl = document.querySelector(
    '.quality-bar.efficiency .quality-fill'
  )
  if (efficiencyEl) {
    const rect = efficiencyEl.getBoundingClientRect()
    hudPositions.value.efficiency = {
      x: rect.left + rect.width,
      y: rect.top + rect.height / 2,
    }
  }

  // Stability bar (quality metrics)
  const stabilityEl = document.querySelector(
    '.quality-bar.stability .quality-fill'
  )
  if (stabilityEl) {
    const rect = stabilityEl.getBoundingClientRect()
    hudPositions.value.stability = {
      x: rect.left + rect.width,
      y: rect.top + rect.height / 2,
    }
  }

  // Fragment preview (prestige panel)
  const fragmentEl = document.querySelector('.fragment-preview')
  if (fragmentEl) {
    const rect = fragmentEl.getBoundingClientRect()
    hudPositions.value.fragment = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }
}

// Spawn a causal particle
function spawnParticle(type: ParticleType, fromX: number, fromY: number) {
  updateHudPositions()

  let target: { x: number; y: number } | undefined
  let duration: number

  switch (type) {
    case 'bandwidth-cost':
      target = hudPositions.value.bandwidth
      duration = 400
      break
    case 'bandwidth-gain':
      // Bandwidth refund from symlink - same target, different color
      target = hudPositions.value.bandwidth
      duration = 350 // Slightly faster for reward feel
      break
    case 'weight-gain':
      target = hudPositions.value.weight
      duration = 500
      break
    case 'weight-loss':
      // Weight decreasing - starts from source, fades out (no target, just dissipates)
      target = { x: fromX, y: fromY - 40 } // Float upward
      duration = 600
      break
    case 'gravity-pulse':
      target = hudPositions.value.gravity
      duration = 600
      break
    case 'efficiency-up':
      // Efficiency improved - flies to efficiency bar (cyan glow)
      target = hudPositions.value.efficiency
      duration = 450
      break
    case 'efficiency-down':
      // Efficiency dropped - warning particle stays near source then fades
      target = { x: fromX + 30, y: fromY - 20 }
      duration = 500
      break
    case 'stability-up':
      // Stability improved - flies to stability bar (green glow)
      target = hudPositions.value.stability
      duration = 450
      break
    case 'stability-down':
      // Stability dropped - warning particle stays near source
      target = { x: fromX - 30, y: fromY - 20 }
      duration = 500
      break
    case 'fragment-collect':
      // Fragment collected - flies to prestige panel fragment area
      target = hudPositions.value.fragment
      duration = 550
      break
    default:
      return
  }

  if (!target) return

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
  }

  particles.value.push(particle)
}

// Spawn multiple particles for big events (burst effect)
function spawnParticleBurst(
  type: ParticleType,
  fromX: number,
  fromY: number,
  count: number = 3
) {
  for (let i = 0; i < count; i++) {
    // Stagger spawns and add slight position variance
    setTimeout(() => {
      const offsetX = (Math.random() - 0.5) * 20
      const offsetY = (Math.random() - 0.5) * 20
      spawnParticle(type, fromX + offsetX, fromY + offsetY)
    }, i * 50)
  }
}

// Animation loop - mutate in place to avoid array allocation every frame
function animate() {
  const now = Date.now()
  const arr = particles.value

  // Update progress and remove expired particles in-place
  let writeIdx = 0
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i]!
    const elapsed = now - p.startTime
    p.progress = Math.min(1, elapsed / p.duration)
    if (p.progress < 1) {
      arr[writeIdx++] = p
    }
  }
  // Check if particles were removed before truncating
  const particlesRemoved = writeIdx < arr.length

  // Truncate array if particles were removed
  if (particlesRemoved) {
    arr.length = writeIdx
  }

  // Trigger Vue update if we have particles OR if we just removed some
  if (arr.length > 0 || particlesRemoved) {
    triggerRef(particles)
  }

  animationFrameId = requestAnimationFrame(animate)
}

// Calculate particle position with easing
function getParticleStyle(p: Particle) {
  // Ease out cubic for smooth deceleration
  const t = 1 - Math.pow(1 - p.progress, 3)

  const x = p.startX + (p.endX - p.startX) * t
  const y = p.startY + (p.endY - p.startY) * t

  // Add slight arc
  const arcHeight = -30 * Math.sin(p.progress * Math.PI)

  return {
    left: `${x}px`,
    top: `${y + arcHeight}px`,
    opacity: 1 - p.progress * 0.5,
    transform: `scale(${1 - p.progress * 0.5})`,
  }
}

// Get particle color based on type
function getParticleClass(type: ParticleType): string {
  switch (type) {
    case 'bandwidth-cost':
      return 'particle-bandwidth'
    case 'bandwidth-gain':
      return 'particle-bandwidth-gain'
    case 'weight-gain':
      return 'particle-weight'
    case 'weight-loss':
      return 'particle-weight-loss'
    case 'gravity-pulse':
      return 'particle-gravity'
    case 'efficiency-up':
      return 'particle-efficiency-up'
    case 'efficiency-down':
      return 'particle-efficiency-down'
    case 'stability-up':
      return 'particle-stability-up'
    case 'stability-down':
      return 'particle-stability-down'
    case 'fragment-collect':
      return 'particle-fragment'
    default:
      return ''
  }
}

// Get icon for particle type
function getParticleIcon(type: ParticleType): string {
  switch (type) {
    case 'bandwidth-cost':
      return '↓'
    case 'bandwidth-gain':
      return '↑'
    case 'weight-gain':
      return '◆'
    case 'weight-loss':
      return '◇'
    case 'gravity-pulse':
      return '◉'
    case 'efficiency-up':
      return '⚡'
    case 'efficiency-down':
      return '⚡'
    case 'stability-up':
      return '✓'
    case 'stability-down':
      return '!'
    case 'fragment-collect':
      return '✦'
    default:
      return '•'
  }
}

// Expose spawn functions for external use
defineExpose({ spawnParticle, spawnParticleBurst })

onMounted(() => {
  animationFrameId = requestAnimationFrame(animate)
  updateHudPositions()
  window.addEventListener('resize', updateHudPositions)
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', updateHudPositions)
})
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
      <span class="particle-icon">{{ getParticleIcon(particle.type) }}</span>
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
  background: radial-gradient(
    circle,
    rgba(122, 122, 255, 0.4) 0%,
    transparent 70%
  );
  box-shadow: 0 0 12px rgba(122, 122, 255, 0.6);
}

.particle-bandwidth-gain {
  color: #5aff7a;
  background: radial-gradient(
    circle,
    rgba(90, 255, 122, 0.5) 0%,
    transparent 70%
  );
  box-shadow: 0 0 16px rgba(90, 255, 122, 0.8);
  animation: particle-pulse 0.2s ease-in-out infinite alternate;
}

.particle-weight {
  color: #ffaa5a;
  background: radial-gradient(
    circle,
    rgba(255, 170, 90, 0.4) 0%,
    transparent 70%
  );
  box-shadow: 0 0 12px rgba(255, 170, 90, 0.6);
}

.particle-gravity {
  color: #a78bfa;
  background: radial-gradient(
    circle,
    rgba(167, 139, 250, 0.4) 0%,
    transparent 70%
  );
  box-shadow: 0 0 12px rgba(167, 139, 250, 0.6);
}

/* Weight loss - fading out effect */
.particle-weight-loss {
  color: #ffaa5a;
  background: radial-gradient(
    circle,
    rgba(255, 170, 90, 0.3) 0%,
    transparent 70%
  );
  box-shadow: 0 0 8px rgba(255, 170, 90, 0.4);
  animation: particle-fade-up 0.6s ease-out forwards;
}

/* Efficiency up - cyan success glow */
.particle-efficiency-up {
  color: #5affff;
  background: radial-gradient(
    circle,
    rgba(90, 255, 255, 0.5) 0%,
    transparent 70%
  );
  box-shadow: 0 0 16px rgba(90, 255, 255, 0.8);
  animation: particle-pulse 0.15s ease-in-out infinite alternate;
}

/* Efficiency down - orange/red warning */
.particle-efficiency-down {
  color: #ff8a5a;
  background: radial-gradient(
    circle,
    rgba(255, 138, 90, 0.5) 0%,
    transparent 70%
  );
  box-shadow: 0 0 12px rgba(255, 138, 90, 0.7);
  animation: particle-warn-shake 0.1s linear infinite;
}

/* Stability up - green success glow */
.particle-stability-up {
  color: #5aff8a;
  background: radial-gradient(
    circle,
    rgba(90, 255, 138, 0.5) 0%,
    transparent 70%
  );
  box-shadow: 0 0 16px rgba(90, 255, 138, 0.8);
  animation: particle-pulse 0.15s ease-in-out infinite alternate;
}

/* Stability down - red warning */
.particle-stability-down {
  color: #ff5a5a;
  background: radial-gradient(
    circle,
    rgba(255, 90, 90, 0.5) 0%,
    transparent 70%
  );
  box-shadow: 0 0 14px rgba(255, 90, 90, 0.8);
  animation: particle-warn-shake 0.08s linear infinite;
}

/* Fragment collect - golden/amber glow flying to prestige */
.particle-fragment {
  color: #ffc85a;
  background: radial-gradient(
    circle,
    rgba(255, 200, 90, 0.6) 0%,
    rgba(255, 170, 60, 0.3) 50%,
    transparent 70%
  );
  box-shadow:
    0 0 16px rgba(255, 200, 90, 0.9),
    0 0 32px rgba(255, 170, 60, 0.4);
  animation: particle-fragment-sparkle 0.12s ease-in-out infinite alternate;
}

@keyframes particle-fragment-sparkle {
  from {
    transform: scale(1) rotate(0deg);
    filter: brightness(1);
  }
  to {
    transform: scale(1.2) rotate(15deg);
    filter: brightness(1.3);
  }
}

@keyframes particle-pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.15);
  }
}

@keyframes particle-fade-up {
  0% {
    opacity: 0.8;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px) scale(0.5);
  }
}

@keyframes particle-warn-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}
</style>
