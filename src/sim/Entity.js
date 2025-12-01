export class Entity {
  constructor({ x = 0, y = 0, radius = 0, mass = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.mass = mass || 1;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  applyImpulse(ix, iy) {
    this.vx += ix / this.mass;
    this.vy += iy / this.mass;
  }
}

export default Entity;
