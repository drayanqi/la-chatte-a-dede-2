import { Entity } from './Entity.js';

export class Ball extends Entity {
  constructor({ x, y, radius, mass }) {
    super({ x, y, radius, mass });
  }
}

export default Ball;
