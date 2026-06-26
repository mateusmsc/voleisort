import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Home from './pages/Home/Home'
import SessionSetup from './pages/Session/SessionSetup'
import ExportSession from './pages/Session/ExportSession'
import Checkin from './pages/Checkin/Checkin'
import Match from './pages/Match/Match'
import PlayerProfile from './pages/Player/PlayerProfile'

// Wrapper que força remount do Match quando o matchId muda,
// garantindo que o estado local (modo, pop-ups) seja sempre limpo.
function MatchWrapper() {
  const { matchId } = useParams()
  return <Match key={matchId} />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/new" element={<SessionSetup />} />
          <Route path="/session/:code/checkin" element={<Checkin />} />
          <Route path="/session/:code/match/:matchId" element={<MatchWrapper />} />
          <Route path="/session/:code/export" element={<ExportSession />} />
          <Route path="/player/:playerId" element={<PlayerProfile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
