import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'

export default function Layout() {
  const location = useLocation()
  const { workspace, loading } = useWorkspace()

  // Hide nav on workspace setup pages and during loading to prevent flicker
  const showNav = !loading && workspace && !location.pathname.startsWith('/setup')

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1 transition-colors ${
      isActive ? 'text-accent' : 'text-slate-400 hover:text-white'
    }`

  return (
    <div className="min-h-screen aurora-bg">
      {/* Main content */}
      <main className={`${showNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 px-6 py-4 safe-area-pb">
          <div className="max-w-md mx-auto flex justify-around items-center">
            <NavLink to="/" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-xs font-medium">Capture</span>
            </NavLink>

            <NavLink to="/notes" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium">Notes</span>
            </NavLink>

            <NavLink to="/graph" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-xs font-medium">Graph</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  )
}
