import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api'

// Types for API responses
export interface LoginResponse {
    access_token: string
    refresh_token: string
    user: {
        id: string
        email: string
        created_at: string
        updated_at: string
    }
}

export interface RegisterResponse {
    access_token: string
    refresh_token: string
    user: {
        id: string
        email: string
        created_at: string
        updated_at: string
    }
}

export interface TokenResponse {
    access_token: string
    refresh_token: string
}

export interface NotesListResponse {
    notes: Array<{
        id: string
        user_id: string
        title: string
        content?: string
        transcript?: string
        audio_url?: string
        duration?: number
        embedding_status: 'pending' | 'processing' | 'completed' | 'failed'
        created_at: string
        updated_at: string
    }>
    total: number
    page: number
    limit: number
}

// Import types from shared
import type { CreateNoteDto, UpdateNoteDto, NoteWithDetails, AudioUploadResponse, SearchResult } from '../../../shared/types'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error: any) => {
        return Promise.reject(error)
    }
)

// Flag to prevent multiple token refresh attempts
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

// Add subscriber to be called after token refresh
function subscribeTokenRefresh(callback: (token: string) => void) {
    refreshSubscribers.push(callback)
}

// Notify all subscribers that token is refreshed
function onTokenRefreshed(token: string) {
    refreshSubscribers.forEach((callback) => callback(token))
    refreshSubscribers = []
}

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as any

        // If error is 401 and we haven't tried refreshing yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, wait for the new token
                return new Promise((resolve) => {
                    subscribeTokenRefresh((token: string) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`
                        resolve(apiClient(originalRequest))
                    })
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                const refreshToken = localStorage.getItem('refresh_token')
                if (!refreshToken) {
                    throw new Error('No refresh token available')
                }

                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refresh_token: refreshToken,
                })

                const { access_token, refresh_token: newRefreshToken } = response.data

                // Store new tokens
                localStorage.setItem('access_token', access_token)
                localStorage.setItem('refresh_token', newRefreshToken)

                // Update authorization header
                apiClient.defaults.headers.Authorization = `Bearer ${access_token}`
                originalRequest.headers.Authorization = `Bearer ${access_token}`

                // Notify all subscribers
                onTokenRefreshed(access_token)

                // Retry original request
                return apiClient(originalRequest)
            } catch (refreshError) {
                // If refresh fails, clear tokens and redirect to login
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                window.location.href = '/login'
                return Promise.reject(refreshError)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

// API client object
export const api = {
    auth: {
        login: async (email: string, password: string): Promise<LoginResponse> => {
            const response = await apiClient.post<LoginResponse>('/auth/login', {
                email,
                password,
            })
            return response.data
        },

        register: async (email: string, password: string): Promise<RegisterResponse> => {
            const response = await apiClient.post<RegisterResponse>('/auth/register', {
                email,
                password,
            })
            return response.data
        },

        refresh: async (): Promise<TokenResponse> => {
            const refreshToken = localStorage.getItem('refresh_token')
            if (!refreshToken) {
                throw new Error('No refresh token available')
            }

            const response = await axios.post<TokenResponse>(
                `${API_BASE_URL}/auth/refresh`,
                {
                    refresh_token: refreshToken,
                }
            )
            return response.data
        },
    },

    notes: {
        list: async (page: number = 1, limit: number = 10): Promise<NotesListResponse> => {
            const response = await apiClient.get<NotesListResponse>('/notes', {
                params: { page, limit },
            })
            return response.data
        },

        get: async (id: string): Promise<NoteWithDetails> => {
            const response = await apiClient.get<NoteWithDetails>(`/notes/${id}`)
            return response.data
        },

        create: async (data: CreateNoteDto): Promise<NoteWithDetails> => {
            const response = await apiClient.post<NoteWithDetails>('/notes', data)
            return response.data
        },

        update: async (id: string, data: UpdateNoteDto): Promise<NoteWithDetails> => {
            const response = await apiClient.patch<NoteWithDetails>(`/notes/${id}`, data)
            return response.data
        },

        delete: async (id: string): Promise<void> => {
            await apiClient.delete(`/notes/${id}`)
        },
    },

    audio: {
        upload: async (file: File): Promise<AudioUploadResponse> => {
            const formData = new FormData()
            formData.append('audio', file)

            const response = await apiClient.post<AudioUploadResponse>(
                '/audio/upload',
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            )
            return response.data
        },

        stream: async (path: string): Promise<Blob> => {
            const response = await apiClient.get(`/audio/stream/${path}`, {
                responseType: 'blob',
            })
            return response.data
        },
    },

    search: {
        semantic: async (query: string, limit: number = 10): Promise<SearchResult[]> => {
            const response = await apiClient.post<SearchResult[]>('/search/semantic', {
                query,
                limit,
            })
            return response.data
        },
    },
}

// Helper function to handle API errors
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (error.response?.data) {
            const data = error.response.data as { message?: string; error?: string }
            return data.message || data.error || 'An error occurred'
        }
        return error.message || 'An error occurred'
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'An unknown error occurred'
}
