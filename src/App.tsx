import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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
  return <RouterProvider router={router} />
}
