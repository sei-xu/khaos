import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ProcessingProvider } from './lib/processingContext';
import { ActiveEntityProvider } from './lib/activeEntityContext';
import { ChatActivityProvider } from './lib/chat/chatActivityContext';
import { PasswordGate } from './components/layout/PasswordGate';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PasswordGate>
        <QueryClientProvider client={queryClient}>
          <ProcessingProvider>
            <ChatActivityProvider>
              <ActiveEntityProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ActiveEntityProvider>
            </ChatActivityProvider>
          </ProcessingProvider>
        </QueryClientProvider>
      </PasswordGate>
    </ErrorBoundary>
  </React.StrictMode>
);
