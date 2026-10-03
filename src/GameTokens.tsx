import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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
  cat: { name: 'Lucky cat', group: 'Mascot', image: '/tokens/lucky-cat.png' },
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
  camera: { name: 'Vintage camera', group: 'Everyday', image: '/tokens/vintage-camera.png' },
  telescope: { name: 'Spyglass telescope', group: 'Everyday', image: '/tokens/telescope.png' },
  crown: { name: 'Royal crown', group: 'Treasures', image: '/tokens/royal-crown.png' },
};

const newPieces: GameToken[] = [
  { id: 'apple', name: 'Apple', group: 'Nature', color: '#c53833', image: '/tokens/apple.png' },
  { id: 'pineapple', name: 'Pineapple', group: 'Nature', color: '#d9a43d', image: '/tokens/pineapple.png' },
  { id: 'sheep', name: 'Sheep', group: 'Animals', color: '#e7d9bd', image: '/tokens/sheep.png' },
  { id: 'scientist', name: 'Scientist', group: 'Everyday', color: '#b88a68', image: '/tokens/scientist.png' },
  { id: 'boot', name: 'Hiking boot', group: 'Everyday', color: '#a7673d', image: '/tokens/hiking-boot.png' },
  { id: 'robot', name: 'Tin robot', group: 'Everyday', color: '#6994ae', image: '/tokens/tin-robot.png' },
  { id: 'typewriter', name: 'Typewriter', group: 'Everyday', color: '#a8844d', image: '/tokens/typewriter.png' },
  { id: 'telephone', name: 'Rotary telephone', group: 'Everyday', color: '#8c795c', image: '/tokens/rotary-telephone.png' },
  { id: 'knight', name: 'Chess knight', group: 'Treasures', color: '#bc8652', image: '/tokens/chess-knight.png' },
  { id: 'owl', name: 'Owl', group: 'Animals', color: '#9b754c', image: '/tokens/owl.png' },
  { id: 'cactus', name: 'Flowering cactus', group: 'Nature', color: '#5a9b6f', image: '/tokens/cactus.png' },
  { id: 'balloon', name: 'Hot-air balloon', group: 'Travel', color: '#be7565', image: '/tokens/hot-air-balloon.png' },
  { id: 'metal-rocker', name: 'Metal rocker', group: 'Mascot', color: '#b88055', image: '/tokens/metal-rocker.png' },
  { id: 'cyborg-gentleman', name: 'Cyborg gentleman', group: 'Mascot', color: '#8c8f9d', image: '/tokens/cyborg-gentleman.png' },
  { id: 'pastel-unicorn', name: 'Pastel unicorn', group: 'Animals', color: '#c799ca', image: '/tokens/pastel-unicorn.png' },
  { id: 'lemur', name: 'Lemur', group: 'Animals', color: '#b9a994', image: '/tokens/lemur.png' },
  { id: 'astronaut-helmet', name: 'Astronaut helmet', group: 'Travel', color: '#c6aa92', image: '/tokens/astronaut-helmet.png' },
  { id: 'red-octopus', name: 'Red octopus', group: 'Animals', color: '#cb574f', image: '/tokens/red-octopus.png' },
  { id: 'raven', name: 'Raven', group: 'Animals', color: '#505e81', image: '/tokens/raven.png' },
  { id: 'arcade-cabinet', name: 'Arcade cabinet', group: 'Everyday', color: '#5680a2', image: '/tokens/arcade-cabinet.png' },
  { id: 'mars-rover', name: 'Mars rover', group: 'Travel', color: '#b79c78', image: '/tokens/mars-rover.png' },
  { id: 'armored-soldier', name: 'Armored soldier', group: 'Mascot', color: '#708468', image: '/tokens/armored-soldier.png' },
  { id: 'ornate-seahorse', name: 'Ornate seahorse', group: 'Animals', color: '#427daa', image: '/tokens/ornate-seahorse.png' },
  { id: 'diving-helmet', name: 'Diving helmet', group: 'Travel', color: '#ad7951', image: '/tokens/diving-helmet.png' },
  { id: 'armillary-sphere', name: 'Armillary sphere', group: 'Treasures', color: '#447eaa', image: '/tokens/armillary-sphere.png' },
  { id: 'lighthouse', name: 'Lighthouse', group: 'Travel', color: '#b95d56', image: '/tokens/lighthouse.png' },
  { id: 'violin', name: 'Violin and bow', group: 'Everyday', color: '#9f663e', image: '/tokens/violin.png' },
  { id: 'hourglass', name: 'Hourglass', group: 'Treasures', color: '#4c82ae', image: '/tokens/hourglass.png' },
  { id: 'explorer-map', name: "Explorer's map", group: 'Treasures', color: '#bf8954', image: '/tokens/explorer-map.png' },
  { id: 'dragon', name: 'Dragon', group: 'Animals', color: '#bf5242', image: '/tokens/dragon.png' },
  { id: 'gramophone', name: 'Gramophone', group: 'Everyday', color: '#527a50', image: '/tokens/gramophone.png' },
];

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
  ...newPieces,
];

const finishedOrder = ['tux', 'car', 'plane', 'ship', 'train', 'cat', 'dog', 'rocket', 'globe', 'gift', 'rabbit', 'lion', 'hippo', 'parrot', 'pelican', 'bus', 'apple', 'pineapple', 'sheep', 'scientist', 'boot', 'camera', 'robot', 'typewriter', 'telephone', 'knight', 'owl', 'cactus', 'telescope', 'balloon', 'metal-rocker', 'cyborg-gentleman', 'pastel-unicorn', 'lemur', 'astronaut-helmet', 'red-octopus', 'raven', 'arcade-cabinet', 'mars-rover', 'armored-soldier', 'ornate-seahorse', 'crown', 'diving-helmet', 'armillary-sphere', 'lighthouse', 'violin', 'hourglass', 'explorer-map', 'dragon', 'gramophone'];
gameTokens.sort((a, b) => {
  const aIndex = finishedOrder.indexOf(a.id);
  const bIndex = finishedOrder.indexOf(b.id);
  return (aIndex < 0 ? 50 : aIndex) - (bIndex < 0 ? 50 : bIndex);
});

type WobbleStyle = CSSProperties & { '--wobble-from': string; '--wobble-to': string };
export function useGameTokenHold() {
  const [heldId, setHeldId] = useState<string | null>(null);
  const [wobbleStyle, setWobbleStyle] = useState<WobbleStyle | undefined>();
  const holdTimer = useRef<number | null>(null);
  const release = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeldId(null);
  }, []);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.hidden) release(); };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
    window.addEventListener('scroll', release, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', release);
      window.removeEventListener('scroll', release, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [release]);
  const press = (id: string) => {
    release();
    const direction = Math.random() < 0.5 ? -1 : 1;
    setWobbleStyle({ '--wobble-from': `${-0.8 * direction}deg`, '--wobble-to': `${1.2 * direction}deg` });
    holdTimer.current = window.setTimeout(() => {
      setHeldId(id);
      holdTimer.current = null;
    }, 350);
  };
  return { heldId, wobbleStyle, press, release };
}

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
  const [previewId, setPreviewId] = useState(selectedId);
  const hold = useGameTokenHold();
  const choose = (id: string) => { hold.release(); onSelect(id); };
  const groups: (TokenGroup | 'All')[] = ['All', 'Mascot', 'Travel', 'Animals', 'Nature', 'Treasures', 'Everyday'];
  const shown = gameTokens.filter(token => (group === 'All' || token.group === group) && token.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="game-token-gallery">
    <p>Click to preview, double-click to choose. Hold a piece for a larger view. Your choice is saved in this browser.</p>
    <div className="game-token-gallery-tools">
      <input aria-label="Search game pieces" placeholder={`Search ${gameTokens.length} pieces`} value={search} onChange={event => setSearch(event.target.value)}/>
      <div className="game-token-groups" aria-label="Game piece groups">{groups.map(name => <button key={name} type="button" aria-pressed={group === name} onClick={() => setGroup(name)}>{name}</button>)}</div>
    </div>
    <div className="game-token-grid">{shown.map(token => <button key={token.id} type="button" className={`game-token-option ${hold.heldId === token.id ? 'is-held' : ''}`} style={hold.heldId === token.id ? hold.wobbleStyle : undefined} aria-label={`Preview ${token.name} game piece; double-click to choose`} aria-pressed={previewId === token.id} onDragStart={event => event.preventDefault()} onPointerDown={event => { if (event.button === 0) hold.press(token.id); }} onClick={() => setPreviewId(token.id)} onDoubleClick={() => choose(token.id)}>
      <GameTokenArt id={token.id}/><span>{token.name}</span>
    </button>)}</div>
    {!shown.length && <p className="game-token-no-results">No pieces match that search.</p>}
    <div className="game-token-gallery-actions"><span>Selected preview: {gameTokens.find(token => token.id === previewId)?.name}</span><button type="button" onClick={() => choose(previewId)}>Use this piece</button></div>
  </div>;
}
