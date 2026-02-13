import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Filter, MoreVertical, Mail, Phone, 
  Edit, Trash2, UserCheck, X, ChevronDown
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, StatusBadge, Avatar, PageLoading, EmptyState, ConfirmDialog, LoadingSpinner } from '../../components/ui';
import { leadsApi } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
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

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [statusCounts, setStatusCounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [convertConfirm, setConvertConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service_type: '',
    event_date: '',
    budget: '',
    message: '',
    status: 'new',
    notes: '',
  });

  useEffect(() => {
    loadLeads();
    if (searchParams.get('new') === 'true') {
      openNewModal();
      setSearchParams({});
    }
  }, [statusFilter]);

  const loadLeads = async () => {
    try {
      const response = await leadsApi.getAll({ 
        status: statusFilter || undefined, 
        search: search || undefined 
      });
      setLeads(response.data.leads);
      setStatusCounts(response.data.statusCounts);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadLeads();
  };

  const openNewModal = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      service_type: '',
      event_date: '',
      budget: '',
      message: '',
      status: 'new',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      service_type: lead.service_type || '',
      event_date: lead.event_date || '',
      budget: lead.budget || '',
      message: lead.message || '',
      status: lead.status,
      notes: lead.notes || '',
    });
    setShowModal(true);
    setOpenMenuId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingLead) {
        await leadsApi.update(editingLead.id, formData);
        toast.success('Lead updated successfully');
      } else {
        await leadsApi.create(formData);
        toast.success('Lead created successfully');
      }
      setShowModal(false);
      loadLeads();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await leadsApi.delete(deleteConfirm.id);
      toast.success('Lead deleted');
      setDeleteConfirm(null);
      loadLeads();
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const handleConvert = async () => {
    try {
      await leadsApi.convert(convertConfirm.id, { createProject: true });
      toast.success('Lead converted to client!');
      setConvertConfirm(null);
      loadLeads();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to convert lead');
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await leadsApi.update(leadId, { status: newStatus });
      toast.success('Status updated');
      loadLeads();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Leads" />
      
      <div className="p-6 space-y-6">
        {/* Stats bar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              !statusFilter 
                ? 'bg-brand-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            )}
          >
            All ({leads.length})
          </button>
          {statusOptions.filter(s => s.value !== 'converted' && s.value !== 'lost').map(status => {
            const count = statusCounts.find(s => s.status === status.value)?.count || 0;
            return (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === status.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                )}
              >
                {status.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <button type="submit" className="btn-secondary">
              Search
            </button>
          </form>
          
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="w-5 h-5" />
            Add Lead
          </button>
        </div>

        {/* Leads list */}
{leads.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {leads.map((lead) => (
      <div key={lead.id} className="card-hover p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar name={lead.name} />
            <div>
              <p className="font-semibold text-white">{lead.name}</p>
              <p className="text-sm text-dark-400">
                {serviceTypes.find(s => s.value === lead.service_type)?.label || 'No service specified'}
              </p>
            </div>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setOpenMenuId(openMenuId === lead.id ? null : lead.id)}
              className="p-1 hover:bg-dark-800 rounded"
            >
              <MoreVertical className="w-4 h-4 text-dark-400" />
            </button>
            
            {openMenuId === lead.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                <div className="absolute right-0 mt-1 w-40 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-20 py-1">
                  <button
                    onClick={() => openEditModal(lead)}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  {lead.status !== 'converted' && (
                    <button
                      onClick={() => { setConvertConfirm(lead); setOpenMenuId(null); }}
                      className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-dark-700 flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      Convert
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteConfirm(lead); setOpenMenuId(null); }}
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

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-dark-400">
            <Mail className="w-4 h-4" />
            <span className="truncate">{lead.email}</span>
          </div>
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-dark-400">
              <Phone className="w-4 h-4" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>

        {lead.event_date && (
          <p className="text-sm text-dark-500 mb-3">
            Event: {format(new Date(lead.event_date), 'MMM d, yyyy')}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-dark-700">
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
            className="text-sm bg-dark-800 border border-dark-700 rounded-lg px-2 py-1 focus:ring-brand-500"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-xs text-dark-500">
            {format(new Date(lead.created_at), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
    ))}
  </div>
) : (
  <EmptyState
    icon={Plus}
    title="No leads found"
    description="Add your first lead to start tracking potential clients"
    action={
      <button onClick={openNewModal} className="btn-primary">
        <Plus className="w-5 h-5" />
        Add Lead
      </button>
    }
  />
)}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
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
              <label className="block text-sm font-medium text-dark-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
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
              <label className="block text-sm font-medium text-dark-300 mb-2">Service Type</label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                className="w-full"
              >
                <option value="">Select service...</option>
                {serviceTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Event Date</label>
              <input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Budget</label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="e.g., $3,000 - $5,000"
                className="w-full"
              />
            </div>
          </div>
          
          {editingLead && (
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
          )}
          
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Internal Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full"
              placeholder="Notes visible only to you..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingLead ? 'Save Changes' : 'Add Lead')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
        confirmText="Delete"
      />

      {/* Convert Confirmation */}
      <ConfirmDialog
        isOpen={!!convertConfirm}
        onClose={() => setConvertConfirm(null)}
        onConfirm={handleConvert}
        title="Convert to Client"
        message={`Convert ${convertConfirm?.name} to a client? This will create a new client account and initial project.`}
        confirmText="Convert"
      />
    </div>
  );
}
