import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { migrujStareZapisy } from './lib/storage'
import Layout from './components/Layout'
import Command from './pages/Command'
import Team from './pages/Team'
import Chat from './pages/Chat'
import AgentProfile from './pages/AgentProfile'
import Brain from './pages/Brain'
import Settings from './pages/Settings'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Command /> },
      { path: 'zespol', element: <Team /> },
      { path: 'czat/:slug', element: <Chat /> },
      { path: 'agent/:slug', element: <AgentProfile /> },
      { path: 'mozg', element: <Brain /> },
      { path: 'ustawienia', element: <Settings /> },
    ],
  },
])

export default function App() {
  // MIGRACJA v3.4 (raz na przegladarke, flaga sf_migracja_v34): starym plikom
  // wlasnym bez naglowka metadanych dokleja naglowek wg STANDARDU ZAPISU.
  // Idempotentna, wiec podwojne wywolanie w React.StrictMode jest bezpieczne.
  useEffect(() => {
    migrujStareZapisy()
  }, [])

  return <RouterProvider router={router} />
}
