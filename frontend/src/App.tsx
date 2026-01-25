import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotesList from './pages/NotesList'
import NoteDetail from './pages/NoteDetail'
import GraphView from './pages/GraphView'
import Record from './pages/Record'
import WorkspaceSetup from './pages/WorkspaceSetup'
import CreateWorkspace from './pages/CreateWorkspace'
import JoinWorkspace from './pages/JoinWorkspace'

// Protected route wrapper - redirects to setup if no workspace
function RequireWorkspace({ children }: { children: React.ReactNode }) {
    const { loading: authLoading } = useAuth()
    const { workspace, loading: wsLoading } = useWorkspace()

    if (authLoading || wsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!workspace) {
        return <Navigate to="/setup" replace />
    }

    return <>{children}</>
}

// Redirect to home if already has workspace
function RedirectIfWorkspace({ children }: { children: React.ReactNode }) {
    const { workspace, loading } = useWorkspace()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (workspace) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}

function AppRoutes() {
    return (
        <Routes>
            {/* Setup routes - no Layout */}
            <Route path="/setup" element={<RedirectIfWorkspace><WorkspaceSetup /></RedirectIfWorkspace>} />
            <Route path="/setup/create" element={<RedirectIfWorkspace><CreateWorkspace /></RedirectIfWorkspace>} />
            <Route path="/setup/join" element={<RedirectIfWorkspace><JoinWorkspace /></RedirectIfWorkspace>} />

            {/* Main app routes - with Layout and workspace protection */}
            <Route path="/" element={<RequireWorkspace><Layout /></RequireWorkspace>}>
                <Route index element={<Home />} />
                <Route path="notes" element={<NotesList />} />
                <Route path="notes/:id" element={<NoteDetail />} />
                <Route path="graph" element={<GraphView />} />
            </Route>

            {/* Record page - full screen, no Layout but requires workspace */}
            <Route path="/record" element={<RequireWorkspace><Record /></RequireWorkspace>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <WorkspaceProvider>
                    <AppRoutes />
                </WorkspaceProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
