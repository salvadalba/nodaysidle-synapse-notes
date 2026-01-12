import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '../../../shared/types'

interface AuthContextType {
    isAuthenticated: boolean
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    // Check if user is authenticated on mount (Forced for single-user mode)
    useEffect(() => {
        const userData: User = {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'user@local',
            created_at: new Date(),
            updated_at: new Date(),
        }
        setUser(userData)
        setIsAuthenticated(true)
        setLoading(false)
    }, [])

    // Auto-refresh token (Disabled for single-user mode)
    useEffect(() => {
        // No-op
    }, [isAuthenticated])

    const login = useCallback(async (email: string, password: string) => {
        // Inert for single-user mode
        console.log('Login called in single-user mode - ignored', { email, password })
    }, [])

    const register = useCallback(async (email: string, password: string) => {
        // Inert for single-user mode
        console.log('Register called in single-user mode - ignored', { email, password })
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        setUser(null)
        setIsAuthenticated(false)
    }, [])

    const value: AuthContextType = {
        isAuthenticated,
        user,
        loading,
        login,
        register,
        logout,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
