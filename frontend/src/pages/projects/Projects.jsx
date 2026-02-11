import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Eye, Edit, Trash2, MoreVertical,
  Calendar, DollarSign, CheckCircle2, Circle, FolderKanban
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, StatusBadge, Avatar, PageLoading, EmptyState, ProgressBar, ConfirmDialog, LoadingSpinner } from '../../components/ui';
import { projectsApi, clientsApi } from '../../utils/api';
import { format } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const statusOptions = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'editing', label: 'Editing' },
  { value: 'review', label: 'Review' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const serviceTypes = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'event', label: 'Event' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
];

export default function Projects() {
  const { isAdmin } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [statusCounts, setStatusCounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    service_type: '',
    status: 'inquiry',
    filming_date: '',
    filming_location: '',
    delivery_date: '',
    budget: '',
    notes: '',
  });

  useEffect(() => {
    loadProjects();
    if (isAdmin()) {
      loadClients();
    }
    if (searchParams.get('new') === 'true') {
      openNewModal();
      setSearchParams({});
    }
  }, [statusFilter]);

  const loadProjects = async () => {
    try {
      const response = await projectsApi.getAll({ 
        status: statusFilter || undefined,
        search: search || undefined 
      });
      setProjects(response.data.projects);
      setStatusCounts(response.data.statusCounts);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientsApi.getAll();
      setClients(response.data.clients);
    } catch (error) {
      console.error('Failed to load clients');
    }
  };

  const openNewModal = () => {
    setEditingProject(null);
    setFormData({
      client_id: '',
      title: '',
      description: '',
      service_type: '',
      status: 'inquiry',
      filming_date: '',
      filming_location: '',
      delivery_date: '',
      budget: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditingProject(project);
    setFormData({
      client_id: project.client_id,
      title: project.title,
      description: project.description || '',
      service_type: project.service_type,
      status: project.status,
      filming_date: project.filming_date || '',
      filming_location: project.filming_location || '',
      delivery_date: project.delivery_date || '',
      budget: project.budget || '',
      notes: project.notes || '',
    });
    setShowModal(true);
    setOpenMenuId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingProject) {
        await projectsApi.update(editingProject.id, formData);
        toast.success('Project updated');
      } else {
        await projectsApi.create(formData);
        toast.success('Project created');
      }
      setShowModal(false);
      loadProjects();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.delete(deleteConfirm.id);
      toast.success('Project deleted');
      setDeleteConfirm(null);
      loadProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Projects" />
      
      <div className="p-6 space-y-6">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setStatusFilter('')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              !statusFilter 
                ? 'bg-brand-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            )}
          >
            All ({projects.length})
          </button>
          {['in_progress', 'editing', 'review', 'delivered', 'completed'].map(status => {
            const count = statusCounts.find(s => s.status === status)?.count || 0;
            const label = statusOptions.find(s => s.value === status)?.label;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  statusFilter === status
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                )}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <form onSubmit={(e) => { e.preventDefault(); loadProjects(); }} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10"
              />
            </div>
          </form>
          
          {isAdmin() && (
            <button onClick={openNewModal} className="btn-primary">
              <Plus className="w-5 h-5" />
              New Project
            </button>
          )}
        </div>

        {/* Projects grid */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="card-hover overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/projects/${project.id}`}
                        className="font-semibold text-white hover:text-brand-400 transition-colors block truncate"
                      >
                        {project.title}
                      </Link>
                      <p className="text-sm text-dark-400">
                        {project.client_name} • {serviceTypes.find(s => s.value === project.service_type)?.label}
                      </p>
                    </div>
                    
                    {isAdmin() && (
                      <div className="relative ml-2">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                          className="p-1 hover:bg-dark-800 rounded"
                        >
                          <MoreVertical className="w-4 h-4 text-dark-400" />
                        </button>
                        
                        {openMenuId === project.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 mt-1 w-40 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-20 py-1">
                              <Link
                                to={`/projects/${project.id}`}
                                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Link>
                              <button
                                onClick={() => openEditModal(project)}
                                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => { setDeleteConfirm(project); setOpenMenuId(null); }}
                                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-dark-400 mb-4">
                    {project.filming_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(project.filming_date), 'MMM d')}
                      </span>
                    )}
                    {project.budget && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {project.budget.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <StatusBadge status={project.status} />
                      <span className="text-dark-400">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects found"
            description={isAdmin() ? "Create your first project to get started" : "Your projects will appear here"}
            action={isAdmin() && (
              <button onClick={openNewModal} className="btn-primary">
                <Plus className="w-5 h-5" />
                New Project
              </button>
            )}
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProject ? 'Edit Project' : 'New Project'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-300 mb-2">Client *</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                required
                className="w-full"
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-300 mb-2">Project Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Service Type *</label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                required
                className="w-full"
              >
                <option value="">Select type...</option>
                {serviceTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Filming Date</label>
              <input
                type="date"
                value={formData.filming_date}
                onChange={(e) => setFormData(prev => ({ ...prev, filming_date: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Delivery Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Location</label>
              <input
                type="text"
                value={formData.filming_location}
                onChange={(e) => setFormData(prev => ({ ...prev, filming_location: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Budget</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                className="w-full"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingProject ? 'Save Changes' : 'Create Project')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
