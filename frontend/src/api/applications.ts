import { api } from './client';
import type { Application, Permissions, Category, ApplicationStatus } from '../types';

export interface ApplicationFormInput {
  title: string;
  category: Category;
  description: string;
  amount: number;
}

export const applicationsApi = {
  list: (status?: ApplicationStatus | 'ALL') =>
    api.get<{ applications: Application[] }>(
      status ? `/applications?status=${status}` : '/applications',
    ),

  get: (id: string) =>
    api.get<{ application: Application; permissions: Permissions }>(`/applications/${id}`),

  create: (data: ApplicationFormInput) =>
    api.post<{ application: Application }>('/applications', data),

  update: (id: string, data: ApplicationFormInput) =>
    api.put<{ application: Application }>(`/applications/${id}`, data),

  remove: (id: string) => api.del<void>(`/applications/${id}`),

  uploadAttachment: (id: string, file: File) =>
    api.upload<{ application: Application }>(`/applications/${id}/attachment`, file),

  submit: (id: string) => api.post<{ application: Application }>(`/applications/${id}/submit`),

  claim: (id: string) => api.post<{ application: Application }>(`/applications/${id}/claim`),

  approve: (id: string) => api.post<{ application: Application }>(`/applications/${id}/approve`),

  reject: (id: string, comment: string) =>
    api.post<{ application: Application }>(`/applications/${id}/reject`, { comment }),

  return: (id: string, comment: string) =>
    api.post<{ application: Application }>(`/applications/${id}/return`, { comment }),
};
