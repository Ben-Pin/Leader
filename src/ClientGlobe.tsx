import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import { ArrowUpRight, ChevronLeft, ChevronRight, Expand, Minus, Plus } from 'lucide-react';
import { request } from './api';
import { countryLocation, worldCountries } from './geography';
import type { Card, CardPage } from './types';

type Coverage = { countries: { country: string; count: number }[]; total: number };
type Rotation = [number, number];
const emptyCoverage: Coverage = { countries: [], total: 0 };
const graticule = geoGraticule10();

export function ClientGlobe({ selected, refresh, query, expanded = false, onExpand, onOpen }: {
  selected: Card | null; refresh: number; query: string; expanded?: boolean;
  onExpand?: () => void; onOpen: (id: string) => void;
}) {
  const [data, setData] = useState<Coverage>(emptyCoverage);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState<Rotation>([-15, -25]);
  const rotationRef = useRef(rotation);
  const animation = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [chosen, setChosen] = useState('');
  const [clients, setClients] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const clientRequest = useRef(0);
  const morePending = useRef(false);
  const drag = useRef<{ x: number; y: number; rotation: Rotation; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const id = useId().replaceAll(':', '');
  const scope = useMemo(() => {
    const params = new URLSearchParams(query);
    params.delete('limit'); params.delete('offset'); params.delete('sort');
    return params.toString();
  }, [query]);
  const stopAnimation = useCallback(() => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  }, []);
  const applyRotation = useCallback((value: Rotation) => {
    rotationRef.current = value;
    setRotation(value);
  }, []);
  const flyTo = useCallback((target: Rotation) => {
    stopAnimation();
    const start: Rotation = [-rotationRef.current[0], -rotationRef.current[1]];
    const end: Rotation = [-target[0], -target[1]];
    const distance = geoDistance(start, end);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || distance < .001) {
      applyRotation(target); return;
    }
    // Follow the shortest great-circle route, including across the date line.
    const interpolate = geoInterpolate(start, end);
    const duration = 650 + 450 * distance / Math.PI;
    const started = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t * t * (3 - 2 * t);
      const point = interpolate(eased);
      applyRotation([-point[0], -point[1]]);
      if (t < 1) animation.current = requestAnimationFrame(frame);
      else animation.current = null;
    };
    animation.current = requestAnimationFrame(frame);
  }, [applyRotation, stopAnimation]);
  useEffect(() => stopAnimation, [stopAnimation]);
  useEffect(() => { setChosen(''); }, [scope]);
  useEffect(() => {
    const ctrl = new AbortController();
    setData(emptyCoverage); setError(''); setLoading(true);
    request<Coverage>(`/geography?${scope}`, { signal: ctrl.signal })
      .then(value => { if (!ctrl.signal.aborted) setData(value); })
      .catch(e => { if (!ctrl.signal.aborted) setError('Не удалось загрузить географию'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [scope, refresh]);
  const countryQuery = useCallback((offset = 0) => {
    const params = new URLSearchParams(scope);
    params.set('country', chosen); params.set('sort', 'title');
    params.set('limit', '50'); params.set('offset', String(offset));
    return params.toString();
  }, [scope, chosen]);
  useEffect(() => {
    const sequence = ++clientRequest.current;
    const ctrl = new AbortController();
    setClients([]); setTotal(0); morePending.current = false; setBusy(Boolean(chosen));
    if (chosen) request<CardPage>(`/cards?${countryQuery()}`, { signal: ctrl.signal })
      .then(page => { if (sequence === clientRequest.current) { setClients(page.items); setTotal(page.total); } })
      .catch(e => { if (!ctrl.signal.aborted) setError('Не удалось загрузить карточки'); })
      .finally(() => { if (sequence === clientRequest.current) setBusy(false); });
    return () => { ctrl.abort(); clientRequest.current++; };
  }, [countryQuery, chosen, refresh]);
  const mapped = useMemo(() => data.countries.map(c => ({ ...c, location: countryLocation(c.country) })), [data]);
  const places = useMemo(() => mapped.filter(c => c.location).map(c => {
    const n = Math.min(c.count, 10000);
    let dots = '';
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(i) * 1.8, a = i * 2.39996, x = Math.cos(a) * r, y = Math.sin(a) * r;
      dots += `M${x - 1},${y}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0 `;
    }
    return { ...c, dots, radius: Math.max(7, Math.sqrt(n) * 2.1) };
  }), [mapped]);
  useEffect(() => {
    const selectedPlace = countryLocation(selected?.country || '');
    const place = mapped.find(c => c.location?.name === selectedPlace?.name)?.location || mapped.find(c => c.location)?.location;
    if (place) flyTo([-place.point[0], -place.point[1]]);
  }, [mapped, selected?.country, flyTo]);
  const unmapped = mapped.filter(c => !c.location).reduce((n, c) => n + c.count, 0);
  const highlight = [selected?.country, selected?.secondaryCountry, chosen].filter(Boolean).map(c => countryLocation(c!)?.name);
  const projection = geoOrthographic().rotate(rotation).translate([200, 200]).scale(187 * zoom).clipAngle(90);
  const path = geoPath(projection);
  const focus = (country: string) => {
    setChosen(country); setError('');
    const place = countryLocation(country);
    if (place) flyTo([-place.point[0], -place.point[1]]);
  };
  const more = async () => {
    if (busy || morePending.current) return;
    const sequence = clientRequest.current;
    morePending.current = true; setBusy(true);
    try {
      const page = await request<CardPage>(`/cards?${countryQuery(clients.length)}`);
      if (sequence === clientRequest.current) { setClients(v => [...v, ...page.items]); setTotal(page.total); }
    } catch { if (sequence === clientRequest.current) setError('Не удалось загрузить карточки'); }
    finally { if (sequence === clientRequest.current) { morePending.current = false; setBusy(false); } }
  };
  const label = loading ? 'Загрузка географии' : `География текущего списка: ${data.total} карточек, ${places.length} стран`;
  const svg = <svg viewBox="0 0 400 400" className="globe-svg" role={expanded ? 'group' : 'img'} aria-label={label} aria-busy={loading}
    style={{ touchAction: expanded ? 'none' : 'auto' }}
    onPointerDown={e => {
      if (!expanded || e.button !== 0) return;
      stopAnimation(); suppressClick.current = false; drag.current = { x: e.clientX, y: e.clientY, rotation: rotationRef.current, moved: false };
      // Let country markers receive clicks; capture only background drags.
      if (!(e.target as Element).closest('[data-country]')) e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onPointerMove={e => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      if (drag.current.moved) suppressClick.current = true;
      if (drag.current.moved) applyRotation([drag.current.rotation[0] + dx * .35, Math.max(-85, Math.min(85, drag.current.rotation[1] - dy * .35))]);
    }} onPointerUp={() => { drag.current = null; }} onPointerLeave={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <defs>
      <radialGradient id={`${id}-ocean`} cx="34%" cy="27%" r="80%"><stop stopColor="#f8fcff"/><stop offset=".68" stopColor="#e2effa"/><stop offset="1" stopColor="#b8d0e9"/></radialGradient>
      <radialGradient id={`${id}-halo`}><stop offset=".75" stopColor="#79a0d9" stopOpacity=".12"/><stop offset="1" stopColor="#79a0d9" stopOpacity="0"/></radialGradient>
      <clipPath id={`${id}-clip`}><path d={path({ type: 'Sphere' }) || ''}/></clipPath>
    </defs>
    <circle cx="200" cy="200" r="200" fill={`url(#${id}-halo)`}/>
    <path d={path({ type: 'Sphere' }) || ''} fill={`url(#${id}-ocean)`} stroke="#aac2df" strokeWidth=".7"/>
    <g clipPath={`url(#${id}-clip)`}>
      <path d={path(graticule) || ''} fill="none" stroke="#aec8e2" strokeWidth=".45" opacity=".6"/>
      {worldCountries.map((c, i) => <path key={c.id || i} d={path(c) || ''} fill={highlight.includes(String(c.properties?.name)) ? '#6e96dc' : '#c1d4e8'} stroke="#f4f9ff" strokeWidth=".55"/>)}
      {places.map(c => {
        const loc = c.location!;
        if (geoDistance(loc.point, [-rotation[0], -rotation[1]]) > Math.PI / 2) return null;
        const p = projection(loc.point); if (!p) return null;
        const active = highlight.includes(loc.name);
        return <g key={c.country} transform={`translate(${p[0]},${p[1]})`} data-country={c.country} role={expanded ? 'button' : undefined} tabIndex={expanded ? 0 : undefined}
          aria-label={`${c.country}: ${c.count} карточек`} aria-pressed={expanded ? chosen === c.country : undefined}
          onClick={expanded ? () => { if (!suppressClick.current) focus(c.country); } : undefined}
          onKeyDown={expanded ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); focus(c.country); } } : undefined}>
          <circle cx="0" cy="0" r={c.radius} fill={active ? '#ffc55c' : '#416bd0'} opacity=".15"/>
          <path d={c.dots} fill={active ? '#bb6900' : '#315dae'}/>
          <circle cx="0" cy="0" r="3" fill={active ? '#ffc55c' : '#416bd0'} stroke="white" strokeWidth="1"/>
        </g>;
      })}
    </g>
  </svg>;
  if (!expanded) return <button className="globe-preview" onClick={onExpand} aria-label={`Открыть глобус клиентов. ${label}`}>
    {svg}<Expand className="globe-expand" size={14}/>{error && <small role="alert">{error}</small>}
  </button>;
  return <div className="globe-explorer">
    <div className="globe-stage" tabIndex={0} aria-label="Вращение глобуса стрелками" onKeyDown={e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const [x, y] = rotationRef.current;
        flyTo([x + (e.key === 'ArrowLeft' ? -15 : e.key === 'ArrowRight' ? 15 : 0), Math.max(-85, Math.min(85, y + (e.key === 'ArrowUp' ? 10 : e.key === 'ArrowDown' ? -10 : 0)))]);
      }
    }}>{svg}<div className="globe-controls">
      <button aria-label="Повернуть глобус влево" onClick={() => flyTo([rotationRef.current[0] - 30, rotationRef.current[1]])}><ChevronLeft size={18}/></button>
      <button aria-label="Уменьшить глобус" disabled={zoom <= .7} onClick={() => setZoom(z => Math.max(.7, z - .1))}><Minus size={17}/></button>
      <button aria-label="Увеличить глобус" disabled={zoom >= 1.6} onClick={() => setZoom(z => Math.min(1.6, z + .1))}><Plus size={17}/></button>
      <button aria-label="Повернуть глобус вправо" onClick={() => flyTo([rotationRef.current[0] + 30, rotationRef.current[1]])}><ChevronRight size={18}/></button>
    </div></div>
    <aside className="globe-directory"><h3>Страны <span>{places.length}</span></h3>
      {loading ? <p role="status">Загрузка…</p> : !places.length && <p>В текущем списке нет карточек с распознанной страной.</p>}
      <div className="country-grid">{places.map(c => <button key={c.country} className={chosen === c.country ? 'selected' : ''} aria-pressed={chosen === c.country} onClick={() => focus(c.country)}>{c.country}<b>{c.count}</b></button>)}</div>
      {unmapped > 0 && <p className="geography-note">Не распознана страна: {unmapped} записей. Укажите её в карточке.</p>}
      {chosen && <div className="globe-clients"><h3>{chosen} <span>{total}</span></h3>{clients.map(c => <button key={c.id} onClick={() => onOpen(c.id)}><span>{c.title}<small>{c.contactName}</small></span><ArrowUpRight size={15}/></button>)}{clients.length < total && <button disabled={busy} onClick={more}>Показать ещё</button>}{busy && <p>Загрузка…</p>}</div>}
      {error && <p role="alert">{error}</p>}
    </aside>
  </div>;
}
