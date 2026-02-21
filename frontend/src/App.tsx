import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutletProvider } from './contexts/OutletContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Reports } from './pages/Reports';
import { Customers } from './pages/Customers';
import { Profitability } from './pages/Profitability';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OutletProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="chat" element={<Chat />} />
              <Route path="reports" element={<Reports />} />
              <Route path="customers" element={<Customers />} />
              <Route path="profitability" element={<Profitability />} />
            </Route>
          </Routes>
        </OutletProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
