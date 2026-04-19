// Tracks which action-rail abilities have been unlocked during the current
// run, in the order they were first unlocked. Leftmost pill = first unlock.

export type AbilityId = 'skip_throw' | 'shake' | 'essence';

const unlockOrder: AbilityId[] = [];

export function unlockAbility(id: AbilityId): void {
  if (!unlockOrder.includes(id)) unlockOrder.push(id);
}

export function getUnlockOrder(): AbilityId[] {
  return unlockOrder;
}

export function resetAbilityRail(): void {
  unlockOrder.length = 0;
}

export function getAbilityRailSave(): AbilityId[] {
  return [...unlockOrder];
}

export function restoreAbilityRail(saved: AbilityId[] | undefined | null): void {
  unlockOrder.length = 0;
  if (!Array.isArray(saved)) return;
  for (const id of saved) {
    if ((id === 'skip_throw' || id === 'shake' || id === 'essence') && !unlockOrder.includes(id)) {
      unlockOrder.push(id);
    }
  }
}
