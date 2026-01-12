import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotesList from './pages/NotesList'
import NoteDetail from './pages/NoteDetail'
import GraphView from './pages/GraphView'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="notes" element={<NotesList />} />
                        <Route path="notes/:id" element={<NoteDetail />} />
                        <Route path="graph" element={<GraphView />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
