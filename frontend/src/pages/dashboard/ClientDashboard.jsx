import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, Receipt, Calendar, Upload, ArrowRight,
  CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { StatCard, StatusBadge, ProgressBar, PageLoading, EmptyState } from '../../components/ui';
import { projectsApi, invoicesApi } from '../../utils/api';
import { format } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function ClientDashboard() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState({ invoices: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, invoicesRes] = await Promise.all([
        projectsApi.getAll(),
        invoicesApi.getAll(),
      ]);
      setProjects(projectsRes.data.projects);
      setInvoices(invoicesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <PageLoading />;

  const activeProjects = projects.filter(p => !['completed', 'cancelled'].includes(p.status));
  const completedProjects = projects.filter(p => p.status === 'completed');
  const pendingInvoices = invoices.invoices.filter(i => ['sent', 'viewed', 'overdue'].includes(i.status));

  return (
    <div className="min-h-screen">
      <Header title="My Dashboard" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Welcome Message */}
        <div className="card p-6 bg-gradient-to-r from-brand-500/10 to-transparent border-brand-500/20">
          <h2 className="text-2xl font-display font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-dark-300 mt-2">
            Here's an overview of your projects and account status.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={FolderKanban}
            label="Active Projects"
            value={activeProjects.length}
            subtext={`${completedProjects.length} completed`}
            iconColor="bg-brand-500/20 text-brand-500"
          />
          <StatCard
            icon={Receipt}
            label="Pending Invoices"
            value={pendingInvoices.length}
            subtext={pendingInvoices.length > 0 ? `$${pendingInvoices.reduce((sum, i) => sum + i.total, 0).toLocaleString()} due` : 'All paid!'}
            iconColor="bg-yellow-500/20 text-yellow-500"
          />
          <StatCard
            icon={CheckCircle}
            label="Projects Completed"
            value={completedProjects.length}
            subtext="Total completed"
            iconColor="bg-green-500/20 text-green-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Projects */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <h2 className="font-semibold text-white">My Projects</h2>
              <Link to="/projects" className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-dark-800">
              {activeProjects.length > 0 ? (
                activeProjects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block p-4 hover:bg-dark-850 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white">{project.title}</h3>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-sm text-dark-400 mb-3">
                      {project.service_type?.replace(/_/g, ' ')}
                      {project.filming_date && ` • Filming: ${format(new Date(project.filming_date), 'MMM d, yyyy')}`}
                    </p>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={project.progress} className="flex-1" />
                      <span className="text-sm text-dark-400">{project.progress}%</span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={FolderKanban}
                  title="No active projects"
                  description="Your projects will appear here"
                />
              )}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <h2 className="font-semibold text-white">Invoices</h2>
              <Link to="/invoices" className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-dark-800">
              {invoices.invoices.length > 0 ? (
                invoices.invoices.slice(0, 5).map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-4 hover:bg-dark-850 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-white">{invoice.invoice_number}</p>
                      <p className="text-sm text-dark-400">
                        {invoice.project_title || 'General'}
                        {invoice.due_date && ` • Due: ${format(new Date(invoice.due_date), 'MMM d')}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">${invoice.total.toLocaleString()}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No invoices"
                  description="Your invoices will appear here"
                />
              )}
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Upload Files</h3>
              <p className="text-sm text-dark-400 mb-3">
                Share inspiration images, paperwork, or other materials for your project.
              </p>
              <Link to="/projects" className="btn-outline btn-sm">
                Go to Projects
              </Link>
            </div>
          </div>

          <div className="card p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Schedule Session</h3>
              <p className="text-sm text-dark-400 mb-3">
                Book an available time slot for filming or a consultation.
              </p>
              <Link to="/calendar" className="btn-outline btn-sm">
                View Calendar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
