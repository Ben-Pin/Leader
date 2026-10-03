import { useState, type CSSProperties } from 'react';
import {
  Anchor, Bike, Bird, BookOpen, Bug, BusFront, Camera, Car, Cat, CloudRain,
  Coffee, Compass, Crown, Dice5, Dog, Fish, Flame, Flower2, Gamepad2, Gem,
  Gift, Globe2, Hammer, Heart, KeyRound, Leaf, Lightbulb, Moon, Mountain,
  Music2, PawPrint, Plane, Rabbit, Rocket, Sailboat, Shield, Ship, Snail,
  Snowflake, Squirrel, Star, Sun, Telescope, TrainFront, Trees, Trophy, Truck,
  Turtle, Waves, type LucideIcon,
} from 'lucide-react';

type TokenGroup = 'Mascot' | 'Travel' | 'Animals' | 'Nature' | 'Treasures' | 'Everyday';
type GameToken = { id: string; name: string; group: TokenGroup; color: string; Icon?: LucideIcon; image?: string };

// Contact sheets are processed once outside Leader. The gallery only consumes
// the finished transparent PNGs; preview icons keep the remaining slots usable.
const finishedPieces: Record<string, Pick<GameToken, 'name' | 'group' | 'image'>> = {
  car: { name: 'Race car', group: 'Travel', image: '/tokens/race-car.png' },
  plane: { name: 'Propeller plane', group: 'Travel', image: '/tokens/propeller-plane.png' },
  ship: { name: 'Tugboat', group: 'Travel', image: '/tokens/tugboat.png' },
  train: { name: 'Steam train', group: 'Travel', image: '/tokens/steam-train.png' },
  cat: { name: 'Lucky cat', group: 'Animals', image: '/tokens/lucky-cat.png' },
  dog: { name: 'Puppy', group: 'Animals', image: '/tokens/puppy.png' },
  rocket: { name: 'Rocket', group: 'Travel', image: '/tokens/rocket.png' },
  globe: { name: 'Globe', group: 'Treasures', image: '/tokens/globe.png' },
  gift: { name: 'Treasure chest', group: 'Treasures', image: '/tokens/treasure-chest.png' },
  rabbit: { name: 'Rabbit', group: 'Animals', image: '/tokens/rabbit.png' },
  lion: { name: 'Lion', group: 'Animals', image: '/tokens/lion.png' },
  hippo: { name: 'Hippo', group: 'Animals', image: '/tokens/hippo.png' },
  parrot: { name: 'Parrot', group: 'Animals', image: '/tokens/parrot.png' },
  pelican: { name: 'Pelican', group: 'Animals', image: '/tokens/pelican.png' },
  bus: { name: 'Double-decker bus', group: 'Travel', image: '/tokens/double-decker-bus.png' },
};

const enamel = ['#bd7953', '#608c9f', '#b69046', '#6f927b', '#8b79a5', '#ba6c77', '#6786ab', '#a58060', '#78987d', '#ad8859'];
const entries: [string, string, TokenGroup, LucideIcon][] = [
  ['car', 'Car', 'Travel', Car], ['truck', 'Truck', 'Travel', Truck], ['train', 'Train', 'Travel', TrainFront],
  ['plane', 'Plane', 'Travel', Plane], ['ship', 'Ship', 'Travel', Ship], ['sailboat', 'Sailboat', 'Travel', Sailboat],
  ['bicycle', 'Bicycle', 'Travel', Bike], ['bus', 'Bus', 'Travel', BusFront], ['rocket', 'Rocket', 'Travel', Rocket],
  ['anchor', 'Anchor', 'Travel', Anchor],
  ['parrot', 'Parrot', 'Animals', Bird], ['cat', 'Cat', 'Animals', Cat], ['dog', 'Dog', 'Animals', Dog],
  ['pelican', 'Pelican', 'Animals', Fish], ['rabbit', 'Rabbit', 'Animals', Rabbit], ['turtle', 'Turtle', 'Animals', Turtle],
  ['lion', 'Lion', 'Animals', Squirrel], ['hippo', 'Hippo', 'Animals', Snail], ['beetle', 'Beetle', 'Animals', Bug],
  ['paw', 'Paw', 'Animals', PawPrint],
  ['flower', 'Flower', 'Nature', Flower2], ['leaf', 'Leaf', 'Nature', Leaf], ['trees', 'Trees', 'Nature', Trees],
  ['mountain', 'Mountain', 'Nature', Mountain], ['sun', 'Sun', 'Nature', Sun], ['moon', 'Moon', 'Nature', Moon],
  ['rain', 'Rain cloud', 'Nature', CloudRain], ['flame', 'Flame', 'Nature', Flame],
  ['snowflake', 'Snowflake', 'Nature', Snowflake], ['waves', 'Waves', 'Nature', Waves],
  ['crown', 'Crown', 'Treasures', Crown], ['gem', 'Gem', 'Treasures', Gem], ['key', 'Key', 'Treasures', KeyRound],
  ['trophy', 'Trophy', 'Treasures', Trophy], ['star', 'Star', 'Treasures', Star], ['heart', 'Heart', 'Treasures', Heart],
  ['shield', 'Shield', 'Treasures', Shield], ['compass', 'Compass', 'Treasures', Compass],
  ['globe', 'Globe', 'Treasures', Globe2], ['gift', 'Gift', 'Treasures', Gift],
  ['telescope', 'Telescope', 'Everyday', Telescope], ['lightbulb', 'Lightbulb', 'Everyday', Lightbulb],
  ['book', 'Book', 'Everyday', BookOpen], ['music', 'Music', 'Everyday', Music2],
  ['camera', 'Camera', 'Everyday', Camera], ['gamepad', 'Gamepad', 'Everyday', Gamepad2],
  ['dice', 'Dice', 'Everyday', Dice5], ['coffee', 'Coffee', 'Everyday', Coffee], ['hammer', 'Hammer', 'Everyday', Hammer],
];

export const gameTokens: GameToken[] = [
  { id: 'tux', name: 'Tux', group: 'Mascot', color: '#e99a26', image: '/tokens/tux-hand-painted.png' },
  ...entries.map(([id, name, group, Icon], index) => ({
    id,
    name: finishedPieces[id]?.name ?? name,
    group: finishedPieces[id]?.group ?? group,
    Icon,
    color: enamel[index % enamel.length],
    image: finishedPieces[id]?.image,
  })),
];

const finishedOrder = ['tux', 'car', 'plane', 'ship', 'train', 'cat', 'dog', 'rocket', 'globe', 'gift', 'rabbit', 'lion', 'hippo', 'parrot', 'pelican', 'bus'];
gameTokens.sort((a, b) => {
  const aIndex = finishedOrder.indexOf(a.id);
  const bIndex = finishedOrder.indexOf(b.id);
  return (aIndex < 0 ? 50 : aIndex) - (bIndex < 0 ? 50 : bIndex);
});

export function GameTokenArt({ id, large = false }: { id: string; large?: boolean }) {
  const token = gameTokens.find(item => item.id === id) || gameTokens[0];
  const Icon = token.Icon;
  return <span className={`game-token-art ${large ? 'large' : ''} ${token.image ? 'is-image' : ''}`} style={{ '--token-enamel': token.color } as CSSProperties} aria-hidden="true">
    <span className="game-token-aura"/>
    <span className="game-token-figure">{token.image ? <img src={token.image} alt="" draggable={false}/> : Icon ? <Icon strokeWidth={1.75}/> : null}</span>
  </span>;
}

export function GameTokenGallery({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<TokenGroup | 'All'>('All');
  const groups: (TokenGroup | 'All')[] = ['All', 'Mascot', 'Travel', 'Animals', 'Nature', 'Treasures', 'Everyday'];
  const shown = gameTokens.filter(token => (group === 'All' || token.group === group) && token.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="game-token-gallery">
    <p>Choose a game piece. Finished figurines appear first; the remaining slots are previews for future batches. Your choice is saved in this browser.</p>
    <div className="game-token-gallery-tools">
      <input aria-label="Search game pieces" placeholder="Search 50 pieces" value={search} onChange={event => setSearch(event.target.value)}/>
      <div className="game-token-groups" aria-label="Game piece groups">{groups.map(name => <button key={name} type="button" aria-pressed={group === name} onClick={() => setGroup(name)}>{name}</button>)}</div>
    </div>
    <div className="game-token-grid">{shown.map(token => <button key={token.id} type="button" className="game-token-option" aria-label={`Choose ${token.name} game piece`} aria-pressed={selectedId === token.id} onClick={() => onSelect(token.id)}>
      <GameTokenArt id={token.id}/><span>{token.name}</span>
    </button>)}</div>
    {!shown.length && <p className="game-token-no-results">No pieces match that search.</p>}
  </div>;
}
