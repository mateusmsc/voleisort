import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Component } from 'react'
import Home from './pages/Home/Home'
import SessionSetup from './pages/Session/SessionSetup'
import ExportSession from './pages/Session/ExportSession'
import Checkin from './pages/Checkin/Checkin'
import Match from './pages/Match/Match'
import PlayerProfile from './pages/Player/PlayerProfile'
import SupabaseCheck from './pages/Dev/SupabaseCheck'
import Panel from './pages/Panel/Panel'

function MatchWrapper() {
  const { matchId } = useParams()
  return <Match key={matchId} />
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center">
          <p className="text-red-500 font-medium mb-2">Erro inesperado</p>
          <pre className="text-xs text-stone-500 text-left bg-stone-100 p-3 rounded-xl overflow-auto">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
            className="mt-4 px-4 py-2 bg-sage-dark text-white rounded-xl text-sm"
          >
            Voltar ao início
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session/new" element={<SessionSetup />} />
            <Route path="/session/:code/checkin" element={<Checkin />} />
            <Route path="/session/:code/match/:matchId" element={<MatchWrapper />} />
            <Route path="/session/:code/export" element={<ExportSession />} />
            <Route path="/player/:playerId" element={<PlayerProfile />} />
            <Route path="/panel/:code" element={<Panel />} />
            <Route path="/dev/supabase" element={<SupabaseCheck />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  )
}
