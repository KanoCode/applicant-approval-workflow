import { api } from './client';
import type { Application, Permissions, Category, ApplicationStatus } from '../types';


const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ApplicationFormInput {
  title: string;
  category: Category;
  description: string;
  amount: number;
}

export const applicationsApi = {
  list: (status?: ApplicationStatus | 'ALL') =>
    api.get<{ applications: Application[] }>(
      status ? `${API_BASE}/applications?status=${status}` :API_BASE+'/applications',
    ),

  get: (id: string) =>
    api.get<{ application: Application; permissions: Permissions }>(`${API_BASE}/applications/${id}`),

  create: (data: ApplicationFormInput) =>
    api.post<{ application: Application }>(API_BASE+'/applications', data),

  update: (id: string, data: ApplicationFormInput) =>
    api.put<{ application: Application }>(`${API_BASE}/applications/${id}`, data),

  remove: (id: string) => api.del<void>(`${API_BASE}/applications/${id}`),

  uploadAttachment: (id: string, file: File) =>
    api.upload<{ application: Application }>(`${API_BASE}/applications/${id}/attachment`, file),

  submit: (id: string) => api.post<{ application: Application }>(`${API_BASE}/applications/${id}/submit`),

  claim: (id: string) => api.post<{ application: Application }>(`${API_BASE}/applications/${id}/claim`),

  approve: (id: string) => api.post<{ application: Application }>(API_BASE+`/applications/${id}/approve`),

  reject: (id: string, comment: string) =>
    api.post<{ application: Application }>(`${API_BASE}/applications/${id}/reject`, { comment }),

  return: (id: string, comment: string) =>
    api.post<{ application: Application }>(`${API_BASE}/applications/${id}/return`, { comment }),
};
