import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-dark-950">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-dark-800 text-white border border-dark-700',
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
        }}
      />
    </div>
  );
}
