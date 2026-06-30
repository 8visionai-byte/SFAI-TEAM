import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Team from './pages/Team'
import Chat from './pages/Chat'
import Brain from './pages/Brain'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Team /> },
      { path: 'czat/:slug', element: <Chat /> },
      { path: 'mozg', element: <Brain /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
