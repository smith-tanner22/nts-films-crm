import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserPlus, FolderKanban, Calendar, 
  FileQuestion, Receipt, BarChart3, Settings, LogOut, Menu, X,
  Film
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useUIStore from '../../stores/uiStore';
import clsx from 'clsx';

const adminNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/leads', icon: UserPlus, label: 'Leads' },
  { path: '/clients', icon: Users, label: 'Clients' },
  { path: '/projects', icon: FolderKanban, label: 'Projects' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/questionnaires', icon: FileQuestion, label: 'Questionnaires' },
  { path: '/invoices', icon: Receipt, label: 'Invoices' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
];

const clientNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/projects', icon: FolderKanban, label: 'My Projects' },
  { path: '/calendar', icon: Calendar, label: 'Schedule' },
  { path: '/invoices', icon: Receipt, label: 'Invoices' },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

  const navItems = isAdmin() ? adminNavItems : clientNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-dark-800">
          <img src="/logo.png" alt="NTS Films" className="w-10 h-10" />
          <span className="text-xl font-display font-bold text-white">NTS Films</span>
          <button 
            onClick={toggleSidebar}
            className="ml-auto lg:hidden text-dark-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                'sidebar-link',
                isActive && 'active'
              )}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-dark-800 p-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-dark-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <NavLink
              to="/settings"
              className={({ isActive }) => clsx(
                'sidebar-link text-sm',
                isActive && 'active'
              )}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </NavLink>
            <button
              onClick={handleLogout}
              className="sidebar-link text-sm w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
