export interface WisdomThought {
  id: string;
  text: string;
  attribution?: string;
}

// No content source has been provided yet. Keep the display pipeline independent
// of customer cards so future thoughts cannot be mistaken for CRM records.
export const wisdomThoughts: readonly WisdomThought[] = [];

export type WisdomListItem<T> =
  | { kind: 'card'; card: T }
  | { kind: 'thought'; thought: WisdomThought };

export function interleaveWisdom<T>(cards: readonly T[], thoughts: readonly WisdomThought[], enabled: boolean, interval = 8): WisdomListItem<T>[] {
  const items: WisdomListItem<T>[] = [];
  cards.forEach((card, index) => {
    items.push({ kind: 'card', card });
    if (!enabled || interval < 1 || (index + 1) % interval !== 0) return;
    const thought = thoughts[Math.floor(index / interval)];
    if (thought?.id && thought.text.trim()) items.push({ kind: 'thought', thought });
  });
  return items;
}
