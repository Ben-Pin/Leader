import { useEffect, useState } from 'react';
import { ArrowUpRight, Link2, X } from 'lucide-react';
import { request } from './api';
import type { AccountType, Card, CardPage, RelatedCard } from './types';

export function Relationships({ card, accountType, distributorIds, disabled, onType, onLinks, onOpen }: {
  card: Card; accountType: AccountType; distributorIds: string[]; disabled: boolean;
  onType: (value: AccountType) => void; onLinks: (ids: string[]) => void; onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState(''), [picker, setPicker] = useState(false);
  const [choices, setChoices] = useState<RelatedCard[]>([]), [known, setKnown] = useState<RelatedCard[]>(card.distributors);
  const [clients, setClients] = useState<Card[]>([]), [total, setTotal] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setKnown(previous => [...previous.filter(x => !card.distributors.some(d => d.id === x.id)), ...card.distributors]); }, [card.distributors]);
  useEffect(() => {
    if (!picker) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      request<CardPage>(`/cards?accountType=channel&sort=title&limit=20&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(page => { setChoices(page.items.filter(c => c.id !== card.id)); setError(''); })
        .catch(e => { if (e.name !== 'AbortError') setError('Could not load partners.'); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [picker, query, card.id]);
  useEffect(() => {
    const controller = new AbortController();
    request<CardPage>(`/cards?distributorId=${encodeURIComponent(card.id)}&sort=title&limit=20`, { signal: controller.signal })
      .then(page => { setClients(page.items); setTotal(page.total); setError(''); })
      .catch(e => { if (e.name !== 'AbortError') setError('Could not load linked clients.'); });
    return () => controller.abort();
  }, [card.id, card.version]);
  const loadMore = async () => {
    setBusy(true); setError('');
    try {
      const page = await request<CardPage>(`/cards?distributorId=${encodeURIComponent(card.id)}&sort=title&limit=20&offset=${clients.length}`);
      setClients(previous => [...previous, ...page.items.filter(c => !previous.some(p => p.id === c.id))]); setTotal(page.total);
    } catch { setError('Could not load linked clients.'); } finally { setBusy(false); }
  };
  return <section className="relationships" aria-label="Account relationships">
    <div className="relationship-heading"><Link2 size={14}/><strong>Relationships</strong><select aria-label="Account type" value={accountType} disabled={disabled} onChange={e => onType(e.target.value as AccountType)}>
      <option value="lead">Lead</option><option value="unspecified">Prospect</option><option value="opportunity">Opportunity</option><option value="client">Customer</option><option value="partner">Partner</option><option value="distributor">Agent</option>
    </select></div>
    <div className="relationship-label">Agents / partners</div>
    {distributorIds.map(id => {
      const item = known.find(x => x.id === id) || choices.find(x => x.id === id);
      return <div className="related-card" key={id}><button className="related-link" disabled={disabled} onClick={() => onOpen(id)}><span>{item?.title || id}{item?.archived ? ' (archived)' : ''}</span><ArrowUpRight size={13}/></button><button aria-label={`Unlink ${item?.title || id}`} title="Unlink" disabled={disabled} onClick={() => onLinks(distributorIds.filter(x => x !== id))}><X size={12}/></button></div>;
    })}
    {!distributorIds.length && <div className="relationship-empty">No partner linked</div>}
    <button className="text-button" disabled={disabled} onClick={() => setPicker(!picker)}>{picker ? 'Close partner search' : '+ Link agent / partner'}</button>
    {picker && <div className="relationship-picker"><input aria-label="Find agent or partner" placeholder="Search partner cards…" value={query} onChange={e => setQuery(e.target.value)} maxLength={200}/>{choices.filter(c => !distributorIds.includes(c.id)).map(c => <button key={c.id} disabled={disabled || distributorIds.length >= 20} onClick={() => { setKnown(previous => [...previous.filter(x => x.id !== c.id), c]); onLinks([...distributorIds, c.id]); setPicker(false); }}><span>{c.title}</span><small>{c.country}</small></button>)}{!choices.length && <small>No matching partner cards</small>}</div>}
    {(accountType === 'distributor' || accountType === 'partner' || total > 0) && <div className="linked-clients"><div className="relationship-label">Clients <b>{total}</b></div>{clients.map(c => <div className="related-card" key={c.id}><button className="related-link" disabled={disabled} onClick={() => onOpen(c.id)}><span>{c.title}<small>{c.country}</small></span><ArrowUpRight size={13}/></button></div>)}{!total && <div className="relationship-empty">No clients linked yet</div>}{clients.length < total && <button className="text-button" disabled={busy} onClick={loadMore}>{busy ? 'Loading…' : `Show more (${clients.length} / ${total})`}</button>}</div>}
    {error && <p role="alert" className="error-message">{error}</p>}
  </section>;
}
