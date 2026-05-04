import { createContext, useContext, useState } from 'react'

// Senha padrão. Para trocar, altere VITE_APP_PASSWORD nas variáveis do Vercel.
const APP_PASSWORD = (import.meta.env.VITE_APP_PASSWORD as string | undefined) || 'sedsc2026'
const SESSION_KEY  = 'aqui:auth'

type AuthContextValue = {
  loggedIn: boolean
  signIn: (password: string) => boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  function signIn(password: string): boolean {
    if (password === APP_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setLoggedIn(true)
      return true
    }
    return false
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY)
    setLoggedIn(false)
  }

  return (
    <AuthContext.Provider value={{ loggedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
