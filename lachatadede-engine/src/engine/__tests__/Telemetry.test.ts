import { describe, expect, it } from 'vitest';
import { POSSESSION_BIN_TICKS, Telemetry, isShotOnTarget } from '../Telemetry.js';

describe('Telemetry - possession ticks', () => {
  it('counts one tick per owned ball, none for a free ball', () => {
    const t = new Telemetry();
    t.recordPossessionTick({ slot: 1, team: 'challenger' }, 0);
    t.recordPossessionTick({ slot: 1, team: 'challenger' }, 1);
    t.recordPossessionTick(null, 2);
    const stats = t.finalize();
    expect(stats.teams.challenger.possessionTicks).toBe(2);
    expect(stats.teams.opponent.possessionTicks).toBe(0);
  });
});

describe('Telemetry - turnovers (Pelo\'s camp law)', () => {
  it('records a turnover only when the ball changes CAMP', () => {
    const t = new Telemetry();
    t.noteKickoff('challenger');
    // Opponent tackles: camp change -> turnover for the opponent
    const turnover = t.registerGain({ slot: 4, team: 'opponent' });
    expect(turnover).toEqual({
      type: 'turnover',
      team: 'opponent',
      takerSlot: 4,
      fromTeam: 'challenger',
    });
    expect(t.finalize().teams.opponent.turnovers).toBe(1);
  });

  it('never records a turnover for a teammate pickup (possession continues)', () => {
    const t = new Telemetry();
    t.noteKickoff('challenger');
    const turnover = t.registerGain({ slot: 3, team: 'challenger' });
    expect(turnover).toBeNull();
    expect(t.finalize().teams.challenger.turnovers).toBe(0);
    expect(t.finalize().teams.opponent.turnovers).toBe(0);
  });

  it('counts a pickup of a free ball by the other camp as a turnover', () => {
    const t = new Telemetry();
    t.noteKickoff('challenger');
    // The challenger shoots: the ball is free but the camp is still challenger
    // (no giveTo since the shot). An opponent collecting it = camp change.
    const turnover = t.registerGain({ slot: 5, team: 'opponent' });
    expect(turnover).not.toBeNull();
    expect(turnover?.fromTeam).toBe('challenger');
  });

  it('does not count a kickoff as a recovery (restart law)', () => {
    const t = new Telemetry();
    t.noteKickoff('challenger');
    t.registerGain({ slot: 2, team: 'opponent' }); // opponent takes it
    t.noteKickoff('challenger'); // goal -> challenger concedes... whatever: restart
    const turnover = t.registerGain({ slot: 4, team: 'challenger' });
    // The kickoff itself was not a turnover; the next gain after it is a
    // normal camp change (opponent held it before the restart)
    expect(turnover).toBeNull();
    expect(t.finalize().teams.challenger.turnovers).toBe(0);
    expect(t.finalize().teams.opponent.turnovers).toBe(1);
  });

  it('returns null for the very first gain of the match (no previous camp)', () => {
    const t = new Telemetry();
    expect(t.registerGain({ slot: 1, team: 'challenger' })).toBeNull();
  });
});

describe('Telemetry - tirs and passes (Pelo\'s shot law)', () => {
  it('counts only ON-TARGET kicks as tirs (team + player); the rest are passes', () => {
    const t = new Telemetry();
    t.recordShot('challenger', 8, true);
    t.recordShot('challenger', 8, false);
    t.recordShot('opponent', 10, false);
    const stats = t.finalize();
    // A tir IS a cadré: 217 "tirs" with 1 cadré would be 1 tir + 216 passes
    expect(stats.teams.challenger.shots).toBe(1);
    expect(stats.teams.challenger.passes).toBe(1);
    expect(stats.teams.opponent.shots).toBe(0);
    expect(stats.teams.opponent.passes).toBe(1);
    // Player shots follow the same law (cadrés only)
    expect(stats.players.find((p) => p.team === 'challenger' && p.slot === 8)?.shots).toBe(1);
  });

  it('completes a pass when the next possession stays in the kicking camp', () => {
    const t = new Telemetry();
    t.recordShot('challenger', 8, false); // pass in flight
    t.recordPossessionTick(null, 10); // ball flying, still pending
    t.recordPossessionTick({ slot: 4, team: 'challenger' }, 11); // teammate receives
    const stats = t.finalize();
    expect(stats.teams.challenger.passes).toBe(1);
    expect(stats.teams.challenger.passesCompleted).toBe(1);
  });

  it('fails a pass when the other camp wins it (interception)', () => {
    const t = new Telemetry();
    t.recordShot('challenger', 8, false);
    t.recordPossessionTick({ slot: 5, team: 'opponent' }, 12);
    const stats = t.finalize();
    expect(stats.teams.challenger.passes).toBe(1);
    expect(stats.teams.challenger.passesCompleted).toBe(0);
    // The interception itself is a turnover (camp change), unchanged
    expect(stats.teams.opponent.turnovers).toBe(0); // registerGain owns that, not possession
  });

  it('keeps a pass pending while the ball is free; it never connects at the whistle', () => {
    const t = new Telemetry();
    t.recordShot('challenger', 8, false);
    for (let tick = 0; tick < 50; tick++) t.recordPossessionTick(null, tick);
    const stats = t.finalize();
    // In the denominator, never in the numerator: the success rate is honest
    expect(stats.teams.challenger.passes).toBe(1);
    expect(stats.teams.challenger.passesCompleted).toBe(0);
  });

  it('resolves exactly one pass per kick even across several possession ticks', () => {
    const t = new Telemetry();
    t.recordShot('challenger', 8, false);
    t.recordPossessionTick({ slot: 4, team: 'challenger' }, 10);
    t.recordPossessionTick({ slot: 4, team: 'challenger' }, 11);
    t.recordPossessionTick({ slot: 2, team: 'challenger' }, 12);
    const stats = t.finalize();
    expect(stats.teams.challenger.passesCompleted).toBe(1);
  });
});

describe('Telemetry - distance', () => {
  it('accumulates actual movement per player and ignores non-positive deltas', () => {
    const t = new Telemetry();
    t.recordMove('challenger', 8, 1.5);
    t.recordMove('challenger', 8, 2.0);
    t.recordMove('challenger', 8, 0);
    t.recordMove('opponent', 10, 0.75);
    const stats = t.finalize();
    expect(stats.players.find((p) => p.team === 'challenger' && p.slot === 8)?.distance).toBeCloseTo(3.5, 9);
    expect(stats.players.find((p) => p.team === 'opponent' && p.slot === 10)?.distance).toBeCloseTo(0.75, 9);
  });
});

describe('Telemetry - possession timeline', () => {
  it('bins possession into challenger share % per 300-tick bin', () => {
    const t = new Telemetry();
    // Bin 0 (ticks 0-299): 100 challenger ticks, 100 opponent ticks, 100 free
    for (let tick = 0; tick < 100; tick++) t.recordPossessionTick({ slot: 1, team: 'challenger' }, tick);
    for (let tick = 100; tick < 200; tick++) t.recordPossessionTick({ slot: 1, team: 'opponent' }, tick);
    // Bin 1 (ticks 300-599): pure opponent
    for (let tick = 300; tick < 400; tick++) t.recordPossessionTick({ slot: 1, team: 'opponent' }, 300 + (tick - 300));
    const stats = t.finalize();
    expect(stats.possessionTimeline).toHaveLength(2);
    expect(stats.possessionTimeline[0]).toBe(50);
    expect(stats.possessionTimeline[1]).toBe(0);
  });

  it('keeps bins sized by POSSESSION_BIN_TICKS (300)', () => {
    expect(POSSESSION_BIN_TICKS).toBe(300);
  });
});

describe('isShotOnTarget (direct-trajectory projection)', () => {
  it('reports on-target for a straight shot into the goal mouth', () => {
    // Challenger shoots from close range toward the opponent mouth center.
    // (Full power from midfield stops ~1.4 units SHORT of the line — friction
    // law BALL_FRICTION 0.95 — so the range must be honest too.)
    expect(isShotOnTarget(80, 25, 120, 25, 1)).toBe(true);
    // Symmetric: opponent shoots toward the challenger goal
    expect(isShotOnTarget(20, 25, -20, 25, 1)).toBe(true);
  });

  it('reports off-target for a full-power midfield shot that dies before the line', () => {
    expect(isShotOnTarget(50, 25, 120, 25, 1)).toBe(false);
  });

  it('reports off-target for shots outside the mouth', () => {
    expect(isShotOnTarget(50, 10, 120, 10, 1)).toBe(false); // flies past the post (y=10 < 15)
    expect(isShotOnTarget(50, 40, 120, 40, 1)).toBe(false);
  });

  it('reports off-target for a weak shot that stops before the line', () => {
    expect(isShotOnTarget(50, 25, 60, 25, 0.1)).toBe(false);
  });

  it('is deterministic for the same inputs', () => {
    const a = isShotOnTarget(30, 20, 130, 30, 0.8);
    const b = isShotOnTarget(30, 20, 130, 30, 0.8);
    expect(a).toBe(b);
  });
});
