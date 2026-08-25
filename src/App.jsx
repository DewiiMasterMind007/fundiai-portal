import { BrowserRouter } from 'react-router-dom'
import AuthGate from './AuthGate'

function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  )
}

export default App
