import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="brand">📚 SED/SC Estudo</span>
      <NavLink to="/importar" className={({ isActive }) => isActive ? 'active' : ''}>
        Importar
      </NavLink>
      <NavLink to="/praticar" className={({ isActive }) => isActive ? 'active' : ''}>
        Praticar
      </NavLink>
      <NavLink to="/flashcards" className={({ isActive }) => isActive ? 'active' : ''}>
        Flashcards
      </NavLink>
    </nav>
  )
}
