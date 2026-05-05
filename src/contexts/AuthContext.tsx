import { createContext, useContext, useState } from 'react'

const SESSION_KEY = 'aqui:user'

type AuthContextValue = {
  loggedIn: boolean
  currentUser: string
  signIn: (username: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string>(
    () => sessionStorage.getItem(SESSION_KEY) ?? ''
  )

  const loggedIn = currentUser !== ''

  function signIn(username: string) {
    const key = username.trim().toLowerCase()
    sessionStorage.setItem(SESSION_KEY, key)
    setCurrentUser(key)
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY)
    setCurrentUser('')
  }

  return (
    <AuthContext.Provider value={{ loggedIn, currentUser, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
