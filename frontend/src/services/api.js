const BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`;

const getToken = () => localStorage.getItem('token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const handle = async (res) => {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// Auth
export const authApi = {
  register: (body) => fetch(`${BASE_URL}/auth-service/register`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  login: (body) => fetch(`${BASE_URL}/auth-service/login`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  verify: () => fetch(`${BASE_URL}/auth-service/verify`, { method: 'POST', headers: headers() }).then(handle),
  getUsers: () => fetch(`${BASE_URL}/auth-service/users`, { headers: headers() }).then(handle),
};

// Projects
export const projectsApi = {
  getAll: (status) => fetch(`${BASE_URL}/projects-service/projects${status ? `?status=${status}` : ''}`, { headers: headers() }).then(handle),
  getById: (id) => fetch(`${BASE_URL}/projects-service/projects/${id}`, { headers: headers() }).then(handle),
  create: (body) => fetch(`${BASE_URL}/projects-service/projects`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  update: (id, body) => fetch(`${BASE_URL}/projects-service/projects/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  delete: (id) => fetch(`${BASE_URL}/projects-service/projects/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
};

// Deliverables
export const deliverablesApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE_URL}/deliverables-service/deliverables${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  getById: (id) => fetch(`${BASE_URL}/deliverables-service/deliverables/${id}`, { headers: headers() }).then(handle),
  create: (body) => fetch(`${BASE_URL}/deliverables-service/deliverables`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  update: (id, body) => fetch(`${BASE_URL}/deliverables-service/deliverables/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  delete: (id) => fetch(`${BASE_URL}/deliverables-service/deliverables/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
};

// Resources
export const resourcesApi = {
  getAll: () => fetch(`${BASE_URL}/resources-service/resources`, { headers: headers() }).then(handle),
  getById: (id) => fetch(`${BASE_URL}/resources-service/resources/${id}`, { headers: headers() }).then(handle),
  create: (body) => fetch(`${BASE_URL}/resources-service/resources`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  update: (id, body) => fetch(`${BASE_URL}/resources-service/resources/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  delete: (id) => fetch(`${BASE_URL}/resources-service/resources/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
  getAllocations: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE_URL}/resources-service/allocations${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  createAllocation: (body) => fetch(`${BASE_URL}/resources-service/allocations`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  deleteAllocation: (id) => fetch(`${BASE_URL}/resources-service/allocations/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
};

// Budget
export const budgetApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE_URL}/budget-service/budget${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  getSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE_URL}/budget-service/budget/summary${q ? `?${q}` : ''}`, { headers: headers() }).then(handle);
  },
  create: (body) => fetch(`${BASE_URL}/budget-service/budget`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  update: (id, body) => fetch(`${BASE_URL}/budget-service/budget/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  delete: (id) => fetch(`${BASE_URL}/budget-service/budget/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
};
