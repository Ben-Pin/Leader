import { useEffect,useId,useRef,useState } from 'react';
import { geoDistance,geoGraticule10,geoOrthographic,geoPath } from 'd3-geo';
import { ArrowUpRight,ChevronLeft,ChevronRight,Expand,Globe2,Minus,Plus } from 'lucide-react';
import { request } from './api';
import { countryLocation,worldCountries } from './geography';
import type { Card,CardPage } from './types';
type Coverage={countries:{country:string;count:number}[];total:number};
export function ClientGlobe({selected,refresh,expanded=false,onExpand,onOpen}:{selected:Card|null;refresh:number;expanded?:boolean;onExpand?:()=>void;onOpen:(id:string)=>void}){
  const [data,setData]=useState<Coverage>({countries:[],total:0});
  const [error,setError]=useState('');
  const [rotation,setRotation]=useState<[number,number]>([-15,-25]);
  const [zoom,setZoom]=useState(1);
  const [chosen,setChosen]=useState('');
  const [clients,setClients]=useState<Card[]>([]),[total,setTotal]=useState(0),[busy,setBusy]=useState(false);
  const drag=useRef<{x:number;y:number;rotation:[number,number]}|null>(null);
  const id=useId().replaceAll(':','');
  useEffect(()=>{const ctrl=new AbortController();request<Coverage>('/geography',{signal:ctrl.signal}).then(setData).catch(e=>{if(e.name!=='AbortError')setError('Не удалось загрузить географию');});return()=>ctrl.abort();},[refresh]);
  useEffect(()=>{const place=countryLocation(selected?.country||'');if(place)setRotation([-place.point[0],-place.point[1]]);},[selected?.id,selected?.country]);
  useEffect(()=>{if(!chosen)return;const ctrl=new AbortController();setBusy(true);setClients([]);setTotal(0);request<CardPage>(`/cards?country=${encodeURIComponent(chosen)}&sort=title&limit=50`,{signal:ctrl.signal}).then(p=>{setClients(p.items);setTotal(p.total);setError('');}).catch(e=>{if(e.name!=='AbortError')setError('Не удалось загрузить карточки');}).finally(()=>{if(!ctrl.signal.aborted)setBusy(false);});return()=>ctrl.abort();},[chosen,refresh]);
  const mapped=data.countries.map(c=>({...c,location:countryLocation(c.country)}));
  const places=mapped.filter(c=>c.location);
  const unmapped=mapped.filter(c=>!c.location).reduce((n,c)=>n+c.count,0);
  const highlight=[selected?.country,selected?.secondaryCountry,chosen].filter(Boolean).map(c=>countryLocation(c!)?.name);
  const projection=geoOrthographic().rotate(rotation).translate([200,200]).scale(177*zoom).clipAngle(90);
  const path=geoPath(projection);
  const focus=(country:string)=>{setChosen(country);const place=countryLocation(country);if(place)setRotation([-place.point[0],-place.point[1]]);};
  const more=async()=>{setBusy(true);try{const p=await request<CardPage>(`/cards?country=${encodeURIComponent(chosen)}&sort=title&limit=50&offset=${clients.length}`);setClients(v=>[...v,...p.items]);setTotal(p.total);}catch{setError('Не удалось загрузить карточки');}finally{setBusy(false);}};
  const svg=<svg viewBox="0 0 400 400" className="globe-svg" role="img" aria-label="Клиенты по странам" style={{touchAction:expanded?'none':'auto'}} onPointerDown={e=>{if(!expanded)return;drag.current={x:e.clientX,y:e.clientY,rotation};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;setRotation([drag.current.rotation[0]+(e.clientX-drag.current.x)*.35,Math.max(-80,Math.min(80,drag.current.rotation[1]-(e.clientY-drag.current.y)*.35))]);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
    <defs><radialGradient id={`${id}-ocean`} cx="34%" cy="27%" r="80%"><stop stopColor="#f8fcff"/><stop offset=".68" stopColor="#e2effa"/><stop offset="1" stopColor="#b8d0e9"/></radialGradient><radialGradient id={`${id}-halo`}><stop offset=".75" stopColor="#79a0d9" stopOpacity=".12"/><stop offset="1" stopColor="#79a0d9" stopOpacity="0"/></radialGradient></defs>
    <circle cx="200" cy="205" r="198" fill={`url(#${id}-halo)`}/><path d={path({type:'Sphere'})||''} fill={`url(#${id}-ocean)`} stroke="#aac2df" strokeWidth=".7"/>
    <path d={path(geoGraticule10())||''} fill="none" stroke="#aec8e2" strokeWidth=".45" opacity=".6"/>
    {worldCountries.map((c,i)=><path key={c.id||i} d={path(c)||''} fill={highlight.includes(String(c.properties?.name))?'#6e96dc':'#c1d4e8'} stroke="#f4f9ff" strokeWidth=".55"><title>{String(c.properties?.name)}</title></path>)}
    {places.map(c=>{const loc=c.location!;if(geoDistance(loc.point,[-rotation[0],-rotation[1]])>Math.PI/2)return null;const p=projection(loc.point);if(!p)return null;const active=highlight.includes(loc.name);const n=Math.min(c.count,10000);let dots='';for(let i=0;i<n;i++){const r=Math.sqrt(i)*1.8,a=i*2.39996,x=p[0]+Math.cos(a)*r,y=p[1]+Math.sin(a)*r;dots+=`M${x-1},${y}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0 `;}return <g key={c.country}><circle cx={p[0]} cy={p[1]} r={Math.max(5,Math.sqrt(n)*2.1)} fill={active?'#ffc55c':'#416bd0'} opacity=".15"/><path d={dots} fill={active?'#bb6900':'#315dae'}><title>{c.country}: {c.count} карточек</title></path><circle cx={p[0]} cy={p[1]} r="3" fill={active?'#ffc55c':'#416bd0'} stroke="white" strokeWidth="1"/></g>;})}
  </svg>;
  if(!expanded)return <button className="globe-preview" onClick={onExpand} aria-label="Открыть глобус клиентов"><div className="globe-preview-heading"><Globe2 size={13}/><span>География клиентов</span><Expand size={12}/></div>{svg}<div className="globe-preview-caption"><strong>{places.length}</strong> стран <span>· {data.total} карточек</span></div>{error&&<small role="alert">{error}</small>}</button>;
  return <div className="globe-explorer"><div className="globe-stage" tabIndex={0} aria-label="Вращение глобуса стрелками" onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setRotation(([x,y])=>[x+(e.key==='ArrowLeft'?-15:e.key==='ArrowRight'?15:0),Math.max(-80,Math.min(80,y+(e.key==='ArrowUp'?10:e.key==='ArrowDown'?-10:0)))]);}}}>
    <div className="globe-stage-title"><span>CLIENT ATLAS</span><h3>{chosen||'Ваши клиенты на карте'}</h3><p>{data.total} карточек · {places.length} стран</p></div>{svg}<div className="globe-controls"><button aria-label="Повернуть глобус влево" onClick={()=>setRotation(([x,y])=>[x-30,y])}><ChevronLeft size={18}/></button><button aria-label="Уменьшить глобус" disabled={zoom<=.7} onClick={()=>setZoom(z=>Math.max(.7,z-.1))}><Minus size={17}/></button><button aria-label="Увеличить глобус" disabled={zoom>=1.6} onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}><Plus size={17}/></button><button aria-label="Повернуть глобус вправо" onClick={()=>setRotation(([x,y])=>[x+30,y])}><ChevronRight size={18}/></button></div><small>Перетаскивайте глобус или используйте стрелки. Точки — карточки в стране, не адреса офисов.</small><a href="https://github.com/topojson/world-atlas" target="_blank" rel="noreferrer">География: Natural Earth / world-atlas</a></div>
    <aside className="globe-directory"><h3>Страны <span>{places.length}</span></h3><div className="country-grid">{places.map(c=><button key={c.country} className={chosen===c.country?'selected':''} onClick={()=>focus(c.country)}>{c.country}<b>{c.count}</b></button>)}</div>{unmapped>0&&<p className="geography-note">Не распознана страна: {unmapped} записей. Укажите её в карточке.</p>}{chosen&&<div className="globe-clients"><h3>{chosen} <span>{total}</span></h3>{clients.map(c=><button key={c.id} onClick={()=>onOpen(c.id)}><span>{c.title}<small>{c.contactName}</small></span><ArrowUpRight size={15}/></button>)}{clients.length<total&&<button disabled={busy} onClick={more}>Показать ещё</button>}{busy&&<p>Загрузка…</p>}</div>}{error&&<p role="alert">{error}</p>}</aside>
  </div>;
}
