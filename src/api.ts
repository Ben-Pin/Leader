export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function request<T>(path: string, options?: { method?: string; body?: unknown; token?: string; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.token ? { 'X-Leader-Token': options.token } : {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: options?.signal,
  });
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError('Сервер недоступен. Проверьте, что Leader запущен.', response.status); }
  if (!response.ok) throw new ApiError(data.error || 'Не удалось выполнить действие.', response.status);
  return data as T;
}
