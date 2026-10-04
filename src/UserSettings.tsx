import { useEffect, useState, type FormEvent } from 'react';
import { Lightbulb, LoaderCircle, Map, Upload } from 'lucide-react';
import { DEFAULT_MAP, DEFAULT_MOTTO, validateMapDimensions, type CustomMap } from './preferences';
import { permanentListDefinitions } from './account-lists';
import type { AccountType } from './types';

export interface UserPreferences { userName: string; motto: string; wisdomEnabled: boolean; mapVisible: boolean; hiddenLists: AccountType[] }

export function UserSettings({ initial, customMap, onSave }: { initial: UserPreferences; customMap: CustomMap | null; onSave: (settings: UserPreferences, map: CustomMap | null | undefined) => Promise<void> }) {
  const [settings, setSettings] = useState(initial);
  const [mapChange, setMapChange] = useState<CustomMap | null | undefined>(undefined);
  const [preview, setPreview] = useState(DEFAULT_MAP);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shownMap = mapChange === undefined ? customMap : mapChange;
  useEffect(() => {
    if (!shownMap) { setPreview(DEFAULT_MAP); return; }
    const url = URL.createObjectURL(shownMap.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [shownMap]);
  const selectMap = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
      const image = await createImageBitmap(file);
      try { validateMapDimensions(image.width, image.height); } finally { image.close(); }
      setMapChange({ blob: file, name: file.name });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read that image.'); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ ...settings, userName: settings.userName.trim() || 'Local user', motto: settings.motto.trim() || DEFAULT_MOTTO }, mapChange); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  };
  return <form className="create-form user-settings" onSubmit={submit}>
    <section><h3>Profile and motto</h3><label>Display name<input value={settings.userName} maxLength={80} onChange={event => setSettings({ ...settings, userName: event.target.value })} disabled={busy}/></label>
      <label>Motto under Leader<input aria-label="Leader motto" value={settings.motto} maxLength={120} placeholder={DEFAULT_MOTTO} onChange={event => setSettings({ ...settings, motto: event.target.value })} disabled={busy}/></label>
      <button type="button" className="text-button" disabled={busy} onClick={() => setSettings({ ...settings, motto: DEFAULT_MOTTO })}>Use default motto</button></section>
    <section><h3><Lightbulb size={17}/>Wisdom</h3><label className="list-transfer-check"><input type="checkbox" checked={settings.wisdomEnabled} disabled={busy} onChange={event => setSettings({ ...settings, wisdomEnabled: event.target.checked })}/> Show thought cards</label><p className="form-hint">A content source has not been connected yet.</p></section>
    <section><h3><Map size={17}/>Background map</h3><label className="list-transfer-check"><input type="checkbox" checked={settings.mapVisible} disabled={busy} onChange={event => setSettings({ ...settings, mapVisible: event.target.checked })}/> Show map when no card is open</label>
      <div className="settings-map-row"><img src={preview} alt="Background map preview"/><div><p>{shownMap?.name || 'Default steampunk map'}</p><label className="settings-map-upload"><Upload size={15}/>Choose custom map<input aria-label="Custom background map" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void selectMap(event.target.files?.[0]); event.target.value = ''; }}/></label><button type="button" className="text-button" disabled={busy} onClick={() => setMapChange(null)}>Use default map</button><p className="form-hint">Square image · 1:1 · up to 20 MB. The whole map stays visible without stretching.</p></div></div></section>
    <section><h3>Visible permanent lists</h3><div className="settings-list-visibility">{permanentListDefinitions.map(list => <label className="list-transfer-check" key={list.type}><input type="checkbox" disabled={busy} checked={!settings.hiddenLists.includes(list.type)} onChange={event => setSettings({ ...settings, hiddenLists: event.target.checked ? settings.hiddenLists.filter(type => type !== list.type) : [...settings.hiddenLists, list.type] })}/><span style={{ color: list.color }}>#</span>{list.name}</label>)}</div></section>
    {error && <p role="alert" className="error-message">{error}</p>}
    <button className="primary-button" disabled={busy}>{busy && <LoaderCircle size={15} className="spin"/>}Save settings</button>
  </form>;
}
