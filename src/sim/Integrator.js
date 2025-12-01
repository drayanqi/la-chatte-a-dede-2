export function integrateEuler(entity, dt) {
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
}

export function applyDamping(entity, damping) {
  entity.vx *= damping;
  entity.vy *= damping;
}

export default { integrateEuler, applyDamping };
