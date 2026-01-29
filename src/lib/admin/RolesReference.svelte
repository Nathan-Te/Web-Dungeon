<script lang="ts">
  import { ROLE_BASE_STATS, ROLE_PREFERRED_ROW, COMBAT_CONSTANTS } from '../game/types';
  import type { Role } from '../game/types';

  const ROLES: { role: Role; color: string; icon: string }[] = [
    { role: 'tank', color: 'border-blue-500 bg-blue-950', icon: 'Shield' },
    { role: 'warrior', color: 'border-orange-500 bg-orange-950', icon: 'Sword' },
    { role: 'archer', color: 'border-green-500 bg-green-950', icon: 'Bow' },
    { role: 'mage', color: 'border-purple-500 bg-purple-950', icon: 'Staff' },
    { role: 'assassin', color: 'border-gray-400 bg-gray-900', icon: 'Dagger' },
    { role: 'healer', color: 'border-emerald-500 bg-emerald-950', icon: 'Cross' },
  ];

  const ROW_LABELS: Record<number, string> = {
    0: 'Front (row 0)',
    1: 'Mid (row 1)',
    2: 'Back (row 2)',
  };

  interface RoleBehavior {
    targeting: string;
    ability: string;
    abilityDetail: string;
    combatNotes: string[];
  }

  const ROLE_BEHAVIORS: Record<Role, RoleBehavior> = {
    tank: {
      targeting: 'Attacks the closest enemy',
      ability: 'Taunt (0.7x ATK)',
      abilityDetail: 'Reduced damage attack that draws aggro. Single target, closest enemy.',
      combatNotes: [
        'Highest HP (1000) and DEF (150) in the game',
        'Lowest SPD (50) — acts last in turn order',
        'Preferred position: Front row — absorbs damage for the team',
        'Taunt deals less damage but forces enemies to target the tank',
      ],
    },
    warrior: {
      targeting: 'Attacks the closest enemy',
      ability: 'Cleave (0.6x ATK, hits up to 3)',
      abilityDetail: 'Sweeping AoE hitting the first 3 enemies for 60% ATK each.',
      combatNotes: [
        'Balanced stats: 700 HP, 120 ATK, 80 DEF',
        'Moderate SPD (70)',
        'Preferred position: Front row — melee fighter',
        'Cleave is the main AoE damage for front-line pressure',
      ],
    },
    archer: {
      targeting: 'Attacks the lowest HP enemy',
      ability: 'Multi-shot (0.7x ATK, 2 random targets)',
      abilityDetail: 'Fires arrows at 2 random enemies for 70% ATK each.',
      combatNotes: [
        'High ATK (150), low HP (500) and DEF (40)',
        'High SPD (90) — acts early in turn order',
        'Preferred position: Back row — ranged attacker',
        'Multi-shot hits random enemies, good for spread damage',
      ],
    },
    mage: {
      targeting: 'Attacks the lowest HP enemy',
      ability: 'Fireball (1.5x ATK, single target)',
      abilityDetail: 'High burst damage spell targeting the weakest enemy.',
      combatNotes: [
        'Highest ATK (180), lowest HP (450) and DEF (30) — glass cannon',
        'Low SPD (60)',
        'Preferred position: Back row — needs protection',
        'Fireball is the highest single-target multiplier in the game',
      ],
    },
    assassin: {
      targeting: 'Attacks a back-row enemy',
      ability: 'Backstab (1.0x ATK, ignores DEF)',
      abilityDetail: 'Strike from shadows targeting back row. Bypasses all defense.',
      combatNotes: [
        'High ATK (140), moderate HP (550)',
        'Highest SPD (120) — always acts first',
        'Preferred position: Mid row — flanker',
        'Backstab ignores DEF entirely, effective against mages/healers',
      ],
    },
    healer: {
      targeting: 'Attacks the closest enemy (basic attack only)',
      ability: 'Heal (2.0x ATK, ally below 70% HP)',
      abilityDetail: 'Restores HP to the most wounded ally below 70% HP. Heals for 200% of ATK.',
      combatNotes: [
        'Lowest ATK (60) but highest heal multiplier (2.0x)',
        'Moderate HP (600) and DEF (60)',
        'High SPD (80) — heals before most allies take damage',
        'Preferred position: Back row — support',
        'Only heals allies below 70% HP threshold; otherwise does basic attack',
      ],
    },
  };
</script>

<div class="space-y-4">
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-2">Combat System Overview</h3>
    <div class="text-sm text-gray-300 space-y-2">
      <p><strong>Turn order:</strong> Units act by descending SPD. Ties broken randomly.</p>
      <p><strong>Damage formula:</strong> <code class="bg-slate-900 px-1 rounded">ATK × (1 − DEF / (DEF + 100))</code> with ±{COMBAT_CONSTANTS.DAMAGE_VARIANCE * 100}% variance.</p>
      <p><strong>Critical hits:</strong> {COMBAT_CONSTANTS.CRIT_CHANCE * 100}% chance for {COMBAT_CONSTANTS.CRIT_MULTIPLIER}x damage.</p>
      <p><strong>Ability trigger:</strong> {COMBAT_CONSTANTS.ABILITY_TRIGGER_CHANCE * 100}% chance each turn to use ability instead of basic attack.</p>
      <p><strong>Max turns:</strong> {COMBAT_CONSTANTS.MAX_TURNS}. If exceeded, the side with more total HP% wins.</p>
      <p><strong>Stat scaling:</strong> <code class="bg-slate-900 px-1 rounded">base × (1 + (level−1) × {COMBAT_CONSTANTS.LEVEL_STAT_BONUS}) × (1 + ascension × {COMBAT_CONSTANTS.ASCENSION_STAT_BONUS})</code>. SPD does not scale with level/ascension.</p>
    </div>
  </div>

  {#each ROLES as { role, color, icon }}
    {@const stats = ROLE_BASE_STATS[role]}
    {@const row = ROLE_PREFERRED_ROW[role]}
    {@const behavior = ROLE_BEHAVIORS[role]}
    <div class="rounded-lg p-4 border {color}">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-lg font-bold capitalize">{role}</span>
        <span class="text-xs text-gray-400">({icon})</span>
        <span class="text-xs px-2 py-0.5 rounded bg-slate-700">{ROW_LABELS[row]}</span>
      </div>

      <!-- Base Stats -->
      <div class="grid grid-cols-4 gap-2 mb-3">
        <div class="bg-slate-900 rounded p-2 text-center">
          <div class="text-xs text-gray-400">HP</div>
          <div class="font-bold text-red-400">{stats.hp}</div>
        </div>
        <div class="bg-slate-900 rounded p-2 text-center">
          <div class="text-xs text-gray-400">ATK</div>
          <div class="font-bold text-orange-400">{stats.atk}</div>
        </div>
        <div class="bg-slate-900 rounded p-2 text-center">
          <div class="text-xs text-gray-400">DEF</div>
          <div class="font-bold text-blue-400">{stats.def}</div>
        </div>
        <div class="bg-slate-900 rounded p-2 text-center">
          <div class="text-xs text-gray-400">SPD</div>
          <div class="font-bold text-green-400">{stats.spd}</div>
        </div>
      </div>

      <!-- Behavior -->
      <div class="space-y-2 text-sm">
        <p><strong class="text-gray-400">Basic Attack:</strong> {behavior.targeting}</p>
        <p><strong class="text-purple-400">Ability:</strong> {behavior.ability}</p>
        <p class="text-xs text-gray-400">{behavior.abilityDetail}</p>
      </div>

      <!-- Notes -->
      <ul class="mt-2 space-y-1">
        {#each behavior.combatNotes as note}
          <li class="text-xs text-gray-300">• {note}</li>
        {/each}
      </ul>
    </div>
  {/each}
</div>
