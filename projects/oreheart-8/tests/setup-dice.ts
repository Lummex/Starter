// Unit tests use the seeded dice so every existing check replays exactly (dice.ts). tests/dice.test.ts switches modes itself.
import { setDiceMode } from '../src/engine/dice';
setDiceMode('seeded');
