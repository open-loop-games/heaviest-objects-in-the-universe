<script setup lang="ts">
import { shallowRef, triggerRef, onMounted, onUnmounted } from 'vue'
import { on, type ParticleType } from '../game/events'

// Event unsubscribers for cleanup
const eventUnsubscribers: Array<() => void> = []

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

// HUD element positions - cached to avoid DOM queries on every spawn
// Plain object (not reactive) since we only read it during spawns
let hudPositions: Record<string, { x: number; y: number }> = {
  bandwidth: { x: 80, y: 36 },
  weight: { x: 200, y: 36 },
  gravity: { x: window.innerWidth - 200, y: window.innerHeight - 36 },
  efficiency: { x: 220, y: 60 },
  stability: { x: 320, y: 60 },
  fragment: { x: window.innerWidth - 100, y: 36 },
}
let positionsCacheValid = false
let fragmentPositionFound = false

// Update HUD positions based on actual element locations
function updateHudPositions() {
  // Bandwidth bar
  const bandwidthEl = document.querySelector('.bar-fill.bandwidth')
  if (bandwidthEl) {
    const rect = bandwidthEl.getBoundingClientRect()
    hudPositions.bandwidth = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // Weight display
  const weightEl = document.querySelector('.weight-icon')
  if (weightEl) {
    const rect = weightEl.getBoundingClientRect()
    hudPositions.weight = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  // Gravity / prestige area (singularity)
  const gravityEl = document.querySelector('.singularity')
  if (gravityEl) {
    const rect = gravityEl.getBoundingClientRect()
    hudPositions.gravity = {
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
    hudPositions.efficiency = {
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
    hudPositions.stability = {
      x: rect.left + rect.width,
      y: rect.top + rect.height / 2,
    }
  }

  // Fragment preview (prestige panel)
  const fragmentEl = document.querySelector('.fragment-preview')
  if (fragmentEl) {
    const rect = fragmentEl.getBoundingClientRect()
    hudPositions.fragment = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    fragmentPositionFound = true
  }

  // Ship button (target for gravity pull tokens)
  // Falls back to orbital-decay panel if button not visible
  const shipButtonEl = document.querySelector('.ship-button.visible')
  const prestigeEl = shipButtonEl ?? document.querySelector('.orbital-decay')
  if (prestigeEl) {
    const rect = prestigeEl.getBoundingClientRect()
    hudPositions.prestige = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  positionsCacheValid = true
}

// Invalidate cache on resize
function invalidatePositions() {
  positionsCacheValid = false
  fragmentPositionFound = false
}

// Spawn a causal particle
function spawnParticle(type: ParticleType, fromX: number, fromY: number) {
  // Only update positions if cache is invalid (e.g., after resize)
  if (!positionsCacheValid) {
    updateHudPositions()
  }

  let target: { x: number; y: number } | undefined
  let duration: number

  switch (type) {
    case 'bandwidth-cost':
      target = hudPositions.bandwidth
      duration = 400
      break
    case 'bandwidth-gain':
      // Bandwidth refund from symlink - same target, different color
      target = hudPositions.bandwidth
      duration = 350 // Slightly faster for reward feel
      break
    case 'weight-gain':
      target = hudPositions.weight
      duration = 500
      break
    case 'weight-loss':
      // Weight decreasing - starts from source, fades out (no target, just dissipates)
      target = { x: fromX, y: fromY - 40 } // Float upward
      duration = 600
      break
    case 'gravity-pulse':
      target = hudPositions.gravity
      duration = 600
      break
    case 'efficiency-up':
      // Efficiency improved - flies to efficiency bar (cyan glow)
      target = hudPositions.efficiency
      duration = 450
      break
    case 'efficiency-down':
      // Efficiency dropped - warning particle stays near source then fades
      target = { x: fromX + 30, y: fromY - 20 }
      duration = 500
      break
    case 'stability-up':
      // Stability improved - flies to stability bar (green glow)
      target = hudPositions.stability
      duration = 450
      break
    case 'stability-down':
      // Stability dropped - warning particle stays near source
      target = { x: fromX - 30, y: fromY - 20 }
      duration = 500
      break
    case 'fragment-collect':
      // Fragment collected - flies to prestige panel fragment area
      // Re-query if fragment position wasn't found (component may mount late)
      if (!fragmentPositionFound) {
        const fragmentEl = document.querySelector('.fragment-preview')
        if (fragmentEl) {
          const rect = fragmentEl.getBoundingClientRect()
          hudPositions.fragment = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
          fragmentPositionFound = true
        }
      }
      target = hudPositions.fragment
      duration = 550
      break
    case 'token-collect':
      // Cache token earned - flies to ship button or prestige panel
      // Always recalculate since ship button visibility changes
      {
        const shipBtn = document.querySelector('.ship-button.visible')
        const prestigePanel = document.querySelector('.orbital-decay')
        const targetEl = shipBtn ?? prestigePanel
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect()
          target = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
        } else {
          target = { x: window.innerWidth - 100, y: 60 }
        }
      }
      duration = 500
      break
    case 'tier-up':
      // Tier up celebration - expands outward from source then fades
      target = { x: fromX + (Math.random() - 0.5) * 100, y: fromY - 80 }
      duration = 900
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
    case 'token-collect':
      return 'particle-token'
    case 'tier-up':
      return 'particle-tier-up'
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
    case 'token-collect':
      return '⟲'
    case 'tier-up':
      return '★'
    default:
      return '•'
  }
}

onMounted(() => {
  animationFrameId = requestAnimationFrame(animate)
  updateHudPositions()
  // Invalidate cache on resize, don't query immediately
  window.addEventListener('resize', invalidatePositions)

  // Subscribe to particle events
  eventUnsubscribers.push(
    on('particles:spawn', ({ type, x, y }) => {
      spawnParticle(type, x, y)
    }),
    on('particles:burst', ({ type, x, y, count }) => {
      spawnParticleBurst(type, x, y, count)
    })
  )
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', invalidatePositions)

  // Cleanup event subscriptions
  for (const unsub of eventUnsubscribers) {
    unsub()
  }
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
  z-index: 2000;
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

/* Token collect - subtle cyan glow for cache tokens */
.particle-token {
  width: 18px;
  height: 18px;
  font-size: 12px;
  color: #5affff;
  background: radial-gradient(
    circle,
    rgba(90, 255, 255, 0.35) 0%,
    rgba(122, 90, 255, 0.2) 50%,
    transparent 70%
  );
  box-shadow:
    0 0 12px rgba(90, 255, 255, 0.4),
    0 0 24px rgba(122, 90, 255, 0.25);
  animation: particle-token-sparkle 0.2s ease-in-out infinite alternate;
}

/* Tier up - bright star burst effect */
.particle-tier-up {
  color: #ffff5a;
  font-size: 20px;
  background: radial-gradient(
    circle,
    rgba(255, 255, 90, 0.8) 0%,
    rgba(255, 200, 90, 0.5) 40%,
    transparent 70%
  );
  box-shadow:
    0 0 24px rgba(255, 255, 90, 1),
    0 0 48px rgba(255, 200, 90, 0.7),
    0 0 72px rgba(255, 170, 60, 0.4);
  animation: particle-tier-up-burst 0.2s ease-out infinite alternate;
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

@keyframes particle-token-sparkle {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.1);
  }
}

@keyframes particle-tier-up-burst {
  from {
    transform: scale(1) rotate(0deg);
    filter: brightness(1) drop-shadow(0 0 8px rgba(255, 255, 90, 0.8));
  }
  to {
    transform: scale(1.5) rotate(20deg);
    filter: brightness(1.5) drop-shadow(0 0 16px rgba(255, 255, 90, 1));
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
