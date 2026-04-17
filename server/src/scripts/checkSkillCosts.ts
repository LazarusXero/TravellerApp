/**
 * Sanity check: run with  npx tsx src/scripts/checkSkillCosts.ts
 * from the /server directory.
 *
 * Expected output:
 *   Unskilled → 0  :  1 SP
 *   0 → 1          :  1 SP
 *   1 → 2          :  2 SP
 *   2 → 3          :  4 SP
 *   3 → 4          :  8 SP
 *   4 → 5          : 16 SP
 *   5 → 6          : 32 SP
 *   6 → 7          : 64 SP
 *   7 → 8          : 128 SP
 */
import { getSkillUpgradeCost } from '../utils/skillCosts.js';

const cases: Array<[number | null, string]> = [
  [null, 'Unskilled → 0'],
  [0,    '0 → 1'],
  [1,    '1 → 2'],
  [2,    '2 → 3'],
  [3,    '3 → 4'],
  [4,    '4 → 5'],
  [5,    '5 → 6'],
  [6,    '6 → 7'],
  [7,    '7 → 8'],
];

const EXPECTED = [1, 1, 2, 4, 8, 16, 32, 64, 128];

let allPassed = true;
for (let i = 0; i < cases.length; i++) {
  const [level, label] = cases[i];
  const cost = getSkillUpgradeCost(level);
  const expected = EXPECTED[i];
  const ok = cost === expected;
  if (!ok) allPassed = false;
  const status = ok ? '✓' : `✗ (expected ${expected})`;
  console.log(`  ${label.padEnd(16)}: ${String(cost).padStart(4)} SP  ${status}`);
}

console.log('');
console.log(allPassed ? '✓ All checks passed.' : '✗ Some checks FAILED.');
process.exit(allPassed ? 0 : 1);
