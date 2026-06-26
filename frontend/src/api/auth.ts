import { api } from './client';
import type { User } from '../types';


const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

console.log(API_BASE)


export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>(API_BASE+'/auth/login', { email, password }),
  me: () => api.get<{ user: User }>(API_BASE+'/auth/me'),
};
