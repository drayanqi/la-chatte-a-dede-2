import { Entity } from './Entity.js';

export class Player extends Entity {
  constructor({ team, number, x, y, radius, mass, stamina = 1, facing = null }) {
    super({ x, y, radius, mass });
    this.team = team;
    this.number = number;
    this.stamina = stamina;
    this.facing = facing || { x: team === 'blue' ? 1 : -1, y: 0 };
  }
}

export default Player;
