import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
export const worldCountries=feature(world as unknown as Topology<{countries:GeometryCollection<{name:string}>}>,world.objects.countries as unknown as GeometryCollection<{name:string}>).features;
const key=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zа-яё0-9]/g,'');
const aliases:Record<string,string>={usa:'United States of America',us:'United States of America',unitedstates:'United States of America',сша:'United States of America',uk:'United Kingdom',greatbritain:'United Kingdom',великобритания:'United Kingdom',england:'United Kingdom',southkorea:'South Korea',czechrepublic:'Czechia',brasil:'Brazil',израиль:'Israel',германия:'Germany',франция:'France',италия:'Italy',испания:'Spain',польша:'Poland',индия:'India',китай:'China',япония:'Japan',канада:'Canada',австралия:'Australia',финляндия:'Finland',швеция:'Sweden',дания:'Denmark',нидерланды:'Netherlands',бельгия:'Belgium',швейцария:'Switzerland',норвегия:'Norway',португалия:'Portugal',бразилия:'Brazil',турция:'Turkey',россия:'Russia',украина:'Ukraine',сингапур:'Singapore',тайвань:'Taiwan',мальта:'Malta',австрия:'Austria',мексика:'Mexico',южнаякорея:'South Korea',новаязеландия:'New Zealand',венгрия:'Hungary',чехия:'Czechia',юар:'South Africa',russianfederation:'Russia',republicofkorea:'South Korea',uae:'United Arab Emirates'};
const tiny:Record<string,[number,number]>={Singapore:[103.82,1.35],Malta:[14.38,35.94],Luxembourg:[6.13,49.8],Bahrain:[50.55,26.05],Mauritius:[57.55,-20.3],Maldives:[73.2,3.2],Andorra:[1.6,42.5],Monaco:[7.4,43.7],Liechtenstein:[9.55,47.14],'Hong Kong':[114.17,22.32]};
export function countryLocation(name:string){
  const normalized=key(aliases[key(name)]||name);
  const tinyEntry=Object.entries(tiny).find(([n])=>key(n)===normalized);
  const shape=worldCountries.find(f=>key(String(f.properties?.name))===normalized);
  if(!shape&&!tinyEntry)return null;
  return {name:String(shape?.properties?.name||tinyEntry?.[0]),point:tinyEntry?.[1]||geoCentroid(shape!),id:shape?.id};
}
export const countryNames=[...new Set([...worldCountries.map(c=>String(c.properties?.name)),...Object.keys(tiny),'United States','Czech Republic'])].sort();
export function tagCategory(name:string){
  if(countryLocation(name.replaceAll('-',' ')))return 'Countries';
  if(/^\d{4}-[1-4]$/.test(name)||/^(q[1-4]|20\d\d|legacy)$/.test(name))return 'Time';
  if(/iot|imx|som|sbc|mcm|ucm|fitlet|tensor|rpi|raspberry|ifm|arm|gateway/i.test(name))return 'Product';
  if(/initial|ramp|mass-production|lead|qualified|proposal|quotation|client|customer|distributor|partner|stage|evaluation|production|клиент|партнёр/i.test(name))return 'Stage';
  if(/energy|medical|industrial|automation|smart|robot|agri|rail|transport|building|iot-app|application|mining|security|defen[cs]e|lighting/i.test(name))return 'Application';
  return 'Other';
}
