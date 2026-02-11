import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  UserPlus, FolderKanban, DollarSign, TrendingUp, ArrowRight,
  Calendar, Users, Plus, ExternalLink
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { StatCard, StatusBadge, Avatar, PageLoading, EmptyState } from '../../components/ui';
import { insightsApi } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await insightsApi.getOverview();
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Admin Dashboard" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={UserPlus}
            label="New Leads"
            value={data?.leads?.new_leads || 0}
            subtext={`${data?.leads?.total_leads || 0} total leads`}
            iconColor="bg-blue-500/20 text-blue-500"
          />
          <StatCard
            icon={FolderKanban}
            label="Active Projects"
            value={data?.projects?.active_projects || 0}
            subtext={`${data?.projects?.completed_projects || 0} completed`}
            iconColor="bg-brand-500/20 text-brand-500"
          />
          <StatCard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${(data?.revenue?.total_revenue || 0).toLocaleString()}`}
            subtext={`$${(data?.revenue?.pending_revenue || 0).toLocaleString()} pending`}
            iconColor="bg-green-500/20 text-green-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Conversion Rate"
            value={`${data?.leads?.conversion_rate || 0}%`}
            subtext={`${data?.leads?.converted_leads || 0} converted`}
            iconColor="bg-purple-500/20 text-purple-500"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <h2 className="font-semibold text-white">Recent Leads</h2>
              <Link to="/leads" className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-dark-800">
              {data?.recentLeads?.length > 0 ? (
                data.recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    to={`/leads?id=${lead.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-dark-850 transition-colors"
                  >
                    <Avatar name={lead.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{lead.name}</p>
                      <p className="text-sm text-dark-400 truncate">{lead.service_type || 'General inquiry'}</p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={UserPlus}
                  title="No leads yet"
                  description="New leads will appear here"
                />
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <h2 className="font-semibold text-white">Upcoming Projects</h2>
              <Link to="/calendar" className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1">
                Calendar <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-dark-800">
              {data?.upcomingEvents?.length > 0 ? (
                data.upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 hover:bg-dark-850 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex flex-col items-center justify-center">
                      <span className="text-xs text-brand-400">
                        {format(new Date(event.start_datetime), 'MMM')}
                      </span>
                      <span className="text-lg font-bold text-brand-500">
                        {format(new Date(event.start_datetime), 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{event.title}</p>
                      <p className="text-sm text-dark-400">
                        {event.client_name && `${event.client_name} • `}
                        {format(new Date(event.start_datetime), 'h:mm a')}
                      </p>
                    </div>
                    {event.project_id && (
                      <Link
                        to={`/projects/${event.project_id}`}
                        className="text-dark-400 hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No upcoming projects"
                  description="Scheduled events will appear here"
                />
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/leads?new=true"
              className="flex flex-col items-center gap-3 p-6 bg-dark-850 rounded-xl border border-dark-700 hover:border-dark-600 hover:bg-dark-800 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-dark-300">Add Lead</span>
            </Link>
            
            <Link
              to="/clients?new=true"
              className="flex flex-col items-center gap-3 p-6 bg-dark-850 rounded-xl border border-dark-700 hover:border-dark-600 hover:bg-dark-800 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-sm font-medium text-dark-300">Add Client</span>
            </Link>
            
            <Link
              to="/projects?new=true"
              className="flex flex-col items-center gap-3 p-6 bg-dark-850 rounded-xl border border-dark-700 hover:border-dark-600 hover:bg-dark-800 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-brand-500" />
              </div>
              <span className="text-sm font-medium text-dark-300">New Project</span>
            </Link>
            
            <Link
              to="/invoices?new=true"
              className="flex flex-col items-center gap-3 p-6 bg-dark-850 rounded-xl border border-dark-700 hover:border-dark-600 hover:bg-dark-800 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm font-medium text-dark-300">Create Invoice</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
