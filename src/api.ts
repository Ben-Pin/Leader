export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
let companyId = localStorage.getItem('leader.company') || 'demo';
export function selectCompany(id: string) { companyId = id; localStorage.setItem('leader.company', id); }

export async function request<T>(path: string, options?: { method?: string; body?: unknown; token?: string; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'X-Leader-Company': companyId,
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.token ? { 'X-Leader-Token': options.token } : {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: options?.signal,
  });
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError('Сервер недоступен. Проверьте, что Leader запущен.', response.status); }
  if (!response.ok && path === '/bootstrap' && data.code === 'COMPANY_NOT_FOUND') {
    const available = await request<{companies:{id:string}[]}>('/companies');
    if (available.companies.length) { selectCompany(available.companies[0].id); return request<T>(path,options); }
  }
  if (!response.ok) throw new ApiError(data.error || 'Не удалось выполнить действие.', response.status);
  return data as T;
}
