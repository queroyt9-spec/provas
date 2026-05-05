import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { signOut, currentUser } = useAuth()

  return (
    <nav className="navbar">
      <span className="brand">📚 SED/SC Estudo</span>
      <NavLink to="/praticar"   className={({ isActive }) => isActive ? 'active' : ''}>Praticar</NavLink>
      <NavLink to="/flashcards" className={({ isActive }) => isActive ? 'active' : ''}>Flashcards</NavLink>
      <NavLink to="/importar"   className={({ isActive }) => isActive ? 'active' : ''}>⚙️ Importar</NavLink>
      <button
        onClick={signOut}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '.88rem', color: 'var(--muted)', padding: '.25rem .5rem',
          borderRadius: 'var(--radius)',
        }}
        title={`Sair (${currentUser})`}
      >
        {currentUser} ↩
      </button>
    </nav>
  )
}
