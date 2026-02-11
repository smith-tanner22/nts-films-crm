// Clients Page
import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Mail, Phone, MoreVertical, Edit, Trash2, ExternalLink, MapPin, X } from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, Avatar, PageLoading, EmptyState, ConfirmDialog, LoadingSpinner } from '../../components/ui';
import { clientsApi } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

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

export default function Clients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    location: '',
    services: [],
    notes: '',
  });

  useEffect(() => {
    loadClients();
    if (searchParams.get('new') === 'true') {
      openNewModal();
      setSearchParams({});
    }
  }, []);

  const loadClients = async () => {
    try {
      const response = await clientsApi.getAll({ search: search || undefined });
      setClients(response.data.clients);
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      location: '',
      services: [],
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company_name: client.company_name || '',
      location: client.location || '',
      services: client.services ? client.services.split(',') : [],
      notes: client.notes || '',
    });
    setShowModal(true);
    setOpenMenuId(null);
  };

  const openViewModal = async (client) => {
    try {
      const response = await clientsApi.getOne(client.id);
      setViewingClient(response.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load client details');
    }
    setOpenMenuId(null);
  };

  const handleServiceToggle = (serviceValue) => {
    setFormData(prev => {
      const services = prev.services.includes(serviceValue)
        ? prev.services.filter(s => s !== serviceValue)
        : [...prev.services, serviceValue];
      return { ...prev, services };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const submitData = {
      ...formData,
      services: formData.services.join(','),
    };

    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, submitData);
        toast.success('Client updated');
      } else {
        await clientsApi.create(submitData);
        toast.success('Client created');
      }
      setShowModal(false);
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save client');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await clientsApi.delete(deleteConfirm.id);
      toast.success('Client deleted');
      setDeleteConfirm(null);
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete client');
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Clients" />
      
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <form onSubmit={(e) => { e.preventDefault(); loadClients(); }} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10"
              />
            </div>
          </form>
          
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="w-5 h-5" />
            Add Client
          </button>
        </div>

        {clients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <div key={client.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={client.name} size="lg" />
                    <div>
                      <h3 className="font-semibold text-white">{client.name}</h3>
                      {client.company_name && (
                        <p className="text-sm text-dark-400">{client.company_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                      className="p-1 hover:bg-dark-800 rounded"
                    >
                      <MoreVertical className="w-4 h-4 text-dark-400" />
                    </button>
                    
                    {openMenuId === client.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 mt-1 w-40 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-20 py-1">
                          <button
                            onClick={() => openViewModal(client)}
                            className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={() => openEditModal(client)}
                            className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteConfirm(client); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {client.email && (
                    <div className="flex items-center gap-2 text-dark-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-dark-400">
                      <Phone className="w-4 h-4" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.location && (
                    <div className="flex items-center gap-2 text-dark-400">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{client.location}</span>
                    </div>
                  )}
                </div>

                {client.services && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {client.services.split(',').slice(0, 3).map(service => (
                      <span key={service} className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                        {serviceTypes.find(s => s.value === service)?.label || service}
                      </span>
                    ))}
                    {client.services.split(',').length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-dark-700 text-dark-400 rounded">
                        +{client.services.split(',').length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-dark-800 text-sm">
                  <span className="text-dark-500">{client.project_count || 0} projects</span>
                  <span className="text-dark-500">{client.active_projects || 0} active</span>
                  {client.total_revenue > 0 && (
                    <span className="text-green-500 ml-auto">${client.total_revenue?.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to get started"
            action={
              <button onClick={openNewModal} className="btn-primary">
                <Plus className="w-5 h-5" />
                Add Client
              </button>
            }
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Company</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Phoenix, AZ"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Services</label>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map(service => (
                <button
                  key={service.value}
                  type="button"
                  onClick={() => handleServiceToggle(service.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.services.includes(service.value)
                      ? 'bg-brand-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {service.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full"
              placeholder="Any additional notes about this client..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingClient ? 'Save Changes' : 'Add Client')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Client Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Client Details"
        size="lg"
      >
        {viewingClient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={viewingClient.client.name} size="xl" />
              <div>
                <h2 className="text-xl font-semibold text-white">{viewingClient.client.name}</h2>
                {viewingClient.client.company_name && (
                  <p className="text-dark-400">{viewingClient.client.company_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {viewingClient.client.email && (
                <div>
                  <label className="text-xs text-dark-500 uppercase">Email</label>
                  <p className="text-dark-200">{viewingClient.client.email}</p>
                </div>
              )}
              {viewingClient.client.phone && (
                <div>
                  <label className="text-xs text-dark-500 uppercase">Phone</label>
                  <p className="text-dark-200">{viewingClient.client.phone}</p>
                </div>
              )}
              {viewingClient.client.location && (
                <div>
                  <label className="text-xs text-dark-500 uppercase">Location</label>
                  <p className="text-dark-200">{viewingClient.client.location}</p>
                </div>
              )}
              {viewingClient.client.services && (
                <div>
                  <label className="text-xs text-dark-500 uppercase">Services</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingClient.client.services.split(',').map(service => (
                      <span key={service} className="px-2 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded">
                        {serviceTypes.find(s => s.value === service)?.label || service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {viewingClient.client.notes && (
              <div>
                <label className="text-xs text-dark-500 uppercase">Notes</label>
                <p className="text-dark-300 mt-1 whitespace-pre-wrap">{viewingClient.client.notes}</p>
              </div>
            )}

            {viewingClient.projects && viewingClient.projects.length > 0 && (
              <div>
                <label className="text-xs text-dark-500 uppercase mb-2 block">Projects</label>
                <div className="space-y-2">
                  {viewingClient.projects.map(project => (
                    <div key={project.id} className="flex items-center justify-between p-3 bg-dark-850 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{project.title}</p>
                        <p className="text-xs text-dark-400">{project.service_type} • {project.status}</p>
                      </div>
                      <Link to={`/projects/${project.id}`} className="text-brand-400 hover:text-brand-300">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
              <button onClick={() => setShowViewModal(false)} className="btn-secondary">
                Close
              </button>
              <button 
                onClick={() => { 
                  setShowViewModal(false); 
                  openEditModal(viewingClient.client); 
                }} 
                className="btn-primary"
              >
                <Edit className="w-4 h-4" />
                Edit Client
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This will also delete all their projects, invoices, and related data. This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
