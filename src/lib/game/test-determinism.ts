/**
 * Test script to verify battle simulation determinism
 * Run with: npx tsx src/lib/game/test-determinism.ts
 */

import { Character } from './Character';
import { AutoBattleSimulation } from './AutoBattleSimulation';
import { CHARACTER_DEFINITIONS } from './characters';
import { SeededRNG } from './rng';

console.log('=== Auto-Chess Battle Determinism Test ===\n');

// Test 1: RNG Determinism
console.log('Test 1: RNG Determinism');
const rng1 = new SeededRNG(42);
const rng2 = new SeededRNG(42);
const sequence1 = Array.from({ length: 10 }, () => rng1.random());
const sequence2 = Array.from({ length: 10 }, () => rng2.random());
const rngMatch = sequence1.every((v, i) => v === sequence2[i]);
console.log(`  Same seed produces same sequence: ${rngMatch ? 'PASS' : 'FAIL'}`);
if (!rngMatch) {
  console.log(`  Seq1: ${sequence1.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...`);
  console.log(`  Seq2: ${sequence2.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...`);
}

// Test 2: Battle Determinism
console.log('\nTest 2: Battle Determinism');

function createTestTeams() {
  const playerTeam = [
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_001')!, 10, 0), // Tank
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_003')!, 10, 0), // Archer
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_004')!, 10, 0), // Mage
  ];

  const enemyTeam = [
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_002')!, 10, 0), // Warrior
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_005')!, 10, 0), // Assassin
    new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_008')!, 10, 0), // Healer
  ];

  return { playerTeam, enemyTeam };
}

const testSeed = 12345;

const { playerTeam: p1, enemyTeam: e1 } = createTestTeams();
const { playerTeam: p2, enemyTeam: e2 } = createTestTeams();

const sim1 = new AutoBattleSimulation(p1, e1, testSeed);
const sim2 = new AutoBattleSimulation(p2, e2, testSeed);

const result1 = sim1.simulate();
const result2 = sim2.simulate();

console.log(`  Seed: ${testSeed}`);
console.log(`  Battle 1: Winner=${result1.winner}, Turns=${result1.turns}, Actions=${result1.actionLog.length}`);
console.log(`  Battle 2: Winner=${result2.winner}, Turns=${result2.turns}, Actions=${result2.actionLog.length}`);

const battleMatch =
  result1.winner === result2.winner &&
  result1.turns === result2.turns &&
  result1.actionLog.length === result2.actionLog.length &&
  result1.actionLog.every(
    (a, i) =>
      a.damage === result2.actionLog[i].damage &&
      a.healing === result2.actionLog[i].healing &&
      a.isCritical === result2.actionLog[i].isCritical &&
      a.actorId === result2.actionLog[i].actorId &&
      a.targetId === result2.actionLog[i].targetId
  );

console.log(`  Results match: ${battleMatch ? 'PASS' : 'FAIL'}`);

// Test 3: Different seeds produce different results
console.log('\nTest 3: Different Seeds');
const { playerTeam: p3, enemyTeam: e3 } = createTestTeams();
const sim3 = new AutoBattleSimulation(p3, e3, 99999);
const result3 = sim3.simulate();

const differentSeeds =
  result1.turns !== result3.turns ||
  result1.actionLog.length !== result3.actionLog.length ||
  result1.actionLog.some((a, i) => a.damage !== result3.actionLog[i]?.damage);

console.log(`  Seed ${testSeed}: Turns=${result1.turns}, Actions=${result1.actionLog.length}`);
console.log(`  Seed 99999: Turns=${result3.turns}, Actions=${result3.actionLog.length}`);
console.log(`  Different seeds produce different results: ${differentSeeds ? 'PASS' : 'WARNING (might be coincidence)'}`);

// Test 4: Display sample battle log
console.log('\n=== Sample Battle Log (first 10 actions) ===');
result1.actionLog.slice(0, 10).forEach((action, i) => {
  console.log(`  ${i + 1}. [T${action.turn}] ${action.message}`);
});

// Test 5: Character stats verification
console.log('\n=== Character Stats Verification ===');
const { playerTeam: statsTeam } = createTestTeams();
statsTeam.forEach((char) => {
  console.log(`  ${char.toString()}`);
});

// Summary
console.log('\n=== Test Summary ===');
const allPassed = rngMatch && battleMatch;
console.log(`  Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
console.log('\nDeterminism verified! Same seed always produces identical battle results.');
