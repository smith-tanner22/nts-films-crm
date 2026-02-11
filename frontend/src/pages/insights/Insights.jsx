import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Users, FolderKanban,
  Calendar, Receipt, Clock, CheckCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { PageLoading } from '../../components/ui';
import { insightsApi } from '../../utils/api';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function Insights() {
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6months');
  const [stats, setStats] = useState({
    revenue: { total: 0, change: 0 },
    projects: { total: 0, active: 0, completed: 0, change: 0 },
    clients: { total: 0, new: 0, change: 0 },
    leads: { total: 0, converted: 0, conversionRate: 0 },
    invoices: { paid: 0, pending: 0, overdue: 0 }
  });
  const [revenueByMonth, setRevenueByMonth] = useState([]);
  const [projectsByStatus, setProjectsByStatus] = useState([]);
  const [projectsByType, setProjectsByType] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [topClients, setTopClients] = useState([]);

  useEffect(() => {
    loadInsights();
  }, [timeRange]);

  const loadInsights = async () => {
    try {
      const response = await insightsApi.getOverview({ range: timeRange });
      const data = response.data;
      
      setStats(data.stats || stats);
      setRevenueByMonth(data.revenueByMonth || []);
      setProjectsByStatus(data.projectsByStatus || []);
      setProjectsByType(data.projectsByType || []);
      setRecentActivity(data.recentActivity || []);
      setTopClients(data.topClients || []);
    } catch (error) {
      console.error('Failed to load insights:', error);
      // Use mock data for demo
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    // Generate mock data for demo purposes
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: format(date, 'MMM'),
        revenue: Math.floor(Math.random() * 15000) + 5000,
        projects: Math.floor(Math.random() * 5) + 1
      });
    }
    setRevenueByMonth(months);

    setStats({
      revenue: { total: 47500, change: 12.5 },
      projects: { total: 24, active: 8, completed: 14, change: 8.3 },
      clients: { total: 18, new: 4, change: 22.2 },
      leads: { total: 32, converted: 12, conversionRate: 37.5 },
      invoices: { paid: 38500, pending: 9000, overdue: 2500 }
    });

    setProjectsByStatus([
      { status: 'In Progress', count: 5, color: 'bg-blue-500' },
      { status: 'Editing', count: 3, color: 'bg-purple-500' },
      { status: 'Completed', count: 14, color: 'bg-green-500' },
      { status: 'Scheduled', count: 2, color: 'bg-yellow-500' }
    ]);

    setProjectsByType([
      { type: 'Wedding', count: 12, revenue: 42000 },
      { type: 'Corporate', count: 6, revenue: 30000 },
      { type: 'Music Video', count: 4, revenue: 34000 },
      { type: 'Event', count: 2, revenue: 8000 }
    ]);

    setTopClients([
      { name: 'Emily Chen', projects: 3, revenue: 10500 },
      { name: 'Mark Thompson', projects: 2, revenue: 8500 },
      { name: 'Sarah Johnson', projects: 2, revenue: 7000 },
      { name: 'David Martinez', projects: 1, revenue: 8500 }
    ]);

    setRecentActivity([
      { type: 'project_completed', message: 'Martinez Music Video completed', time: '2 hours ago' },
      { type: 'invoice_paid', message: 'Invoice INV-2026-001 paid ($8,500)', time: '5 hours ago' },
      { type: 'lead_converted', message: 'New lead converted: Johnson Wedding', time: '1 day ago' },
      { type: 'project_started', message: 'Chen Wedding moved to In Progress', time: '2 days ago' }
    ]);
  };

  const StatCard = ({ title, value, change, icon: Icon, prefix = '', suffix = '', changeLabel = 'vs last period' }) => (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
          {change !== undefined && (
            <div className={clsx(
              'flex items-center gap-1 mt-2 text-sm',
              change >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{Math.abs(change)}%</span>
              <span className="text-dark-500">{changeLabel}</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-brand-500" />
        </div>
      </div>
    </div>
  );

  const maxRevenue = Math.max(...revenueByMonth.map(m => m.revenue), 1);

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Insights & Analytics" />
      
      <div className="p-6 space-y-6">
        {/* Time Range Selector */}
        <div className="flex justify-end">
          <div className="flex gap-2">
            {[
              { value: '30days', label: '30 Days' },
              { value: '3months', label: '3 Months' },
              { value: '6months', label: '6 Months' },
              { value: '1year', label: '1 Year' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  timeRange === option.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={stats.revenue.total}
            change={stats.revenue.change}
            icon={DollarSign}
            prefix="$"
          />
          <StatCard
            title="Total Projects"
            value={stats.projects.total}
            change={stats.projects.change}
            icon={FolderKanban}
            suffix={` (${stats.projects.active} active)`}
          />
          <StatCard
            title="Total Clients"
            value={stats.clients.total}
            change={stats.clients.change}
            icon={Users}
            suffix={` (${stats.clients.new} new)`}
          />
          <StatCard
            title="Lead Conversion"
            value={stats.leads.conversionRate}
            icon={TrendingUp}
            suffix="%"
            changeLabel={`${stats.leads.converted} of ${stats.leads.total} leads`}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Revenue Overview</h3>
            <div className="h-64 flex items-end gap-2">
              {revenueByMonth.map((month, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative flex flex-col justify-end" style={{ height: '200px' }}>
                    <div
                      className="w-full bg-brand-500 rounded-t-lg transition-all duration-500 hover:bg-brand-400"
                      style={{ height: `${(month.revenue / maxRevenue) * 100}%`, minHeight: '4px' }}
                    />
                  </div>
                  <span className="text-xs text-dark-400">{month.month}</span>
                  <span className="text-xs text-dark-500">${(month.revenue / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projects by Status */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Projects by Status</h3>
            <div className="space-y-4">
              {projectsByStatus.map((item, index) => {
                const total = projectsByStatus.reduce((sum, p) => sum + p.count, 0);
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between mb-2">
                      <span className="text-dark-200">{item.status}</span>
                      <span className="text-dark-400">{item.count} projects</span>
                    </div>
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-500', item.color)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue by Service Type */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Revenue by Service</h3>
            <div className="space-y-4">
              {projectsByType.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-3 h-3 rounded-full',
                      index === 0 ? 'bg-brand-500' :
                      index === 1 ? 'bg-purple-500' :
                      index === 2 ? 'bg-blue-500' : 'bg-green-500'
                    )} />
                    <span className="text-dark-200">{item.type}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">${item.revenue.toLocaleString()}</p>
                    <p className="text-xs text-dark-500">{item.count} projects</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Clients */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Top Clients</h3>
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-medium">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-dark-200 font-medium">{client.name}</p>
                      <p className="text-xs text-dark-500">{client.projects} projects</p>
                    </div>
                  </div>
                  <p className="text-green-500 font-medium">${client.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Invoice Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-dark-200">Paid</span>
                </div>
                <span className="text-green-500 font-semibold">${stats.invoices.paid.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <span className="text-dark-200">Pending</span>
                </div>
                <span className="text-yellow-500 font-semibold">${stats.invoices.pending.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-red-500" />
                  <span className="text-dark-200">Overdue</span>
                </div>
                <span className="text-red-500 font-semibold">${stats.invoices.overdue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-dark-850 rounded-lg">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  activity.type === 'project_completed' ? 'bg-green-500/20' :
                  activity.type === 'invoice_paid' ? 'bg-brand-500/20' :
                  activity.type === 'lead_converted' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                )}>
                  {activity.type === 'project_completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {activity.type === 'invoice_paid' && <DollarSign className="w-5 h-5 text-brand-500" />}
                  {activity.type === 'lead_converted' && <Users className="w-5 h-5 text-purple-500" />}
                  {activity.type === 'project_started' && <FolderKanban className="w-5 h-5 text-blue-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-dark-200">{activity.message}</p>
                  <p className="text-xs text-dark-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
