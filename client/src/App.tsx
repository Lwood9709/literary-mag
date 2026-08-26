import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import PiecePage from './pages/PiecePage'
import Admin from './pages/Admin'
import Colophon from './pages/Colophon'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/piece/:id" element={<PiecePage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/colophon" element={<Colophon />} />
      </Routes>
    </BrowserRouter>
  )
}
