import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Extension } from './extension'
import { ErrorBoundary } from '../components/ErrorBoundary'

const root = createRoot(document.getElementById('root'))

root.render(
  <ErrorBoundary>
    <MemoryRouter>
      <Extension />
    </MemoryRouter>
  </ErrorBoundary>,
)
