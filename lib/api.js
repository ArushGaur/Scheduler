export async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined') {
    // Session ended: reload so the sign-in screen appears.
    window.location.reload();
  }
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}
