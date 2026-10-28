export const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export function createPersonalApi(base = '/api') {
  return async function api(path, { method = 'GET', body, signal } = {}) {
    const response = await fetch(base + path, {
      method, signal, credentials: 'same-origin',
      headers: { 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => {
      if (response.ok) throw new Error('The server returned an unexpected response. Please try again.');
      return {};
    });
    if (!response.ok) {
      const error = new Error(data.error || 'Unable to reach the server. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  };
}
export function displayDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
