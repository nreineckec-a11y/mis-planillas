import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DataProvider } from './state.tsx'
import { registrarActualizaciones } from './pwa.ts'
import { iniciarTema } from './lib/prefs.ts'

iniciarTema()
registrarActualizaciones()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>,
)
