export const DEFAULT_CONFIG = {
  field: { width: 900, height: 600 },
  player: { radius: 14, mass: 10, maxSpeed: 320, maxAccel: 1200, sprintMultiplier: 1.35, staminaMax: 100 },
  ball: { radius: 7, mass: 1, friction: 0.995, rollingResistance: 0.998 },
  physics: { dt: 1/60, aiTickHz: 30, collisionRestitution: 0.7, playerPlayerRestitution: 0.6, maxSubSteps: 5 },
  kick: { maxPower: 1200, kickRange: 20, controlRadius: 18, controlStrength: 600, controlTimeoutOnKick: 200 },
  game: { matchTimePerHalf: 300, postGoalPause: 1.5 }
};
