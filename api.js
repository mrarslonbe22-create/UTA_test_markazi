export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch { const e = new Error("Internet bilan aloqa yo'q"); e.status = 0; throw e; }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const e = new Error(data?.error || 'Xatolik yuz berdi'); e.status = res.status;
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw e;
  }
  return data;
}
