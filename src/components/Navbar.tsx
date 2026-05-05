import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { signOut, currentUser } = useAuth()
  const shortUser = currentUser.length > 12 ? `${currentUser.slice(0, 12)}…` : currentUser

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="navbar">
        <span className="brand">📚 SED/SC Estudo</span>

        {/* Links visíveis só no desktop */}
        <span className="navbar-desktop-links">
          <NavLink to="/praticar"   className={({ isActive }) => isActive ? 'active' : ''}>Praticar</NavLink>
          <NavLink to="/flashcards" className={({ isActive }) => isActive ? 'active' : ''}>Flashcards</NavLink>
          <NavLink to="/importar"   className={({ isActive }) => isActive ? 'active' : ''}>⚙️ Importar</NavLink>
        </span>

        <button
          onClick={signOut}
          className="navbar-logout"
          title={`Sair (${currentUser})`}
        >
          {shortUser} ↩
        </button>
      </nav>

      {/* ── Bottom tab bar (mobile only) ── */}
      <nav className="bottom-nav">
        <NavLink to="/praticar"   className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}>
          <span className="bottom-nav-icon">📝</span>
          <span>Praticar</span>
        </NavLink>
        <NavLink to="/flashcards" className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}>
          <span className="bottom-nav-icon">🗂️</span>
          <span>Flashcards</span>
        </NavLink>
        <NavLink to="/importar"   className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}>
          <span className="bottom-nav-icon">⚙️</span>
          <span>Importar</span>
        </NavLink>
      </nav>
    </>
  )
}
