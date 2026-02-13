import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Receipt, MoreVertical, Edit, Trash2, Send, Download,
  DollarSign, Clock, CheckCircle, AlertCircle, Eye, FileText
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, PageLoading, EmptyState, ConfirmDialog, LoadingSpinner, StatusBadge, Avatar } from '../../components/ui';
import { invoicesApi, clientsApi, projectsApi } from '../../utils/api';
import { format, parseISO } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const statusOptions = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-500' },
  { value: 'viewed', label: 'Viewed', color: 'bg-purple-500' },
  { value: 'paid', label: 'Paid', color: 'bg-green-500' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-dark-500' },
];

export default function Invoices() {
  const { isAdmin, user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    project_id: '',
    due_date: '',
    notes: '',
    status: 'draft',
    items: [{ description: '', quantity: 1, rate: 0 }],
  });

  useEffect(() => {
    loadInvoices();
    if (isAdmin()) {
      loadClients();
      loadProjects();
    }
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      const response = await invoicesApi.getAll({ status: statusFilter || undefined });
      setInvoices(response.data.invoices);
      
      // Calculate stats
      const all = response.data.invoices;
      setStats({
        total: all.reduce((sum, inv) => sum + (inv.total || 0), 0),
        paid: all.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0),
        pending: all.filter(i => ['sent', 'viewed'].includes(i.status)).reduce((sum, inv) => sum + (inv.total || 0), 0),
        overdue: all.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + (inv.total || 0), 0),
      });
    } catch (error) {
      toast.error('Failed to load invoices');
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

  const loadProjects = async () => {
    try {
      const response = await projectsApi.getAll();
      setProjects(response.data.projects);
    } catch (error) {
      console.error('Failed to load projects');
    }
  };

  const openNewModal = () => {
    setEditingInvoice(null);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    setFormData({
      client_id: searchParams.get('client') || '',
      project_id: searchParams.get('project') || '',
      due_date: format(dueDate, 'yyyy-MM-dd'),
      notes: '',
      status: 'draft',
      items: [{ description: '', quantity: 1, rate: 0 }],
    });
    setShowModal(true);
    setSearchParams({});
  };

  const openEditModal = (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id,
      project_id: invoice.project_id || '',
      due_date: invoice.due_date,
      notes: invoice.notes || '',
      status: invoice.status || 'draft',
      items: Array.isArray(invoice.items) ? invoice.items : (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : [{ description: '', quantity: 1, rate: 0 }]),
    });
    setShowModal(true);
    setOpenMenuId(null);
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0 }]
    }));
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => 
      sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0), 0
    );
    return { subtotal, tax: 0, total: subtotal };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const totals = calculateTotals();
    
    // Prepare items - ensure each has required fields
    const preparedItems = formData.items.map(item => ({
      description: item.description || 'Service',
      quantity: parseFloat(item.quantity) || 1,
      rate: parseFloat(item.rate) || 0,
      amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0)
    }));

    const submitData = {
      client_id: formData.client_id,
      project_id: formData.project_id || null,
      due_date: formData.due_date,
      notes: formData.notes,
      status: formData.status,
      items: preparedItems, // Send as array, backend handles both
      subtotal: totals.subtotal,
      tax_rate: 0,
      tax_amount: totals.tax,
      discount: 0,
      total: totals.total,
    };

    console.log('Submitting invoice:', submitData);

    try {
      if (editingInvoice) {
        await invoicesApi.update(editingInvoice.id, submitData);
        toast.success('Invoice updated');
      } else {
        await invoicesApi.create(submitData);
        toast.success('Invoice created');
      }
      setShowModal(false);
      loadInvoices();
    } catch (error) {
      console.error('Invoice error:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await invoicesApi.delete(deleteConfirm.id);
      toast.success('Invoice deleted');
      setDeleteConfirm(null);
      loadInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const handleSend = async (invoice) => {
    try {
      await invoicesApi.send(invoice.id);
      toast.success('Invoice sent!');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to send invoice');
    }
    setOpenMenuId(null);
  };

  const handleMarkPaid = async (invoice) => {
    try {
      await invoicesApi.update(invoice.id, { status: 'paid', paid_at: new Date().toISOString() });
      toast.success('Marked as paid');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to update invoice');
    }
    setOpenMenuId(null);
  };

  const totals = calculateTotals();

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Invoices" />
      
      <div className="p-6 space-y-6">
        {/* Stats */}
        {isAdmin() && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm text-dark-400">Total</p>
                  <p className="text-xl font-semibold text-white">${stats.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-dark-400">Paid</p>
                  <p className="text-xl font-semibold text-green-500">${stats.paid.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-dark-400">Pending</p>
                  <p className="text-xl font-semibold text-blue-500">${stats.pending.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-dark-400">Overdue</p>
                  <p className="text-xl font-semibold text-red-500">${stats.overdue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                !statusFilter ? 'bg-brand-500 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              )}
            >
              All
            </button>
            {statusOptions.slice(0, 5).map(status => (
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
                {status.label}
              </button>
            ))}
          </div>
          
          {isAdmin() && (
            <button onClick={openNewModal} className="btn-primary">
              <Plus className="w-5 h-5" />
              New Invoice
            </button>
          )}
        </div>

        {/* Invoices List */}
        {invoices.length > 0 ? (
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-dark-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{invoice.invoice_number}</p>
                          {invoice.project_title && (
                            <p className="text-sm text-dark-400">{invoice.project_title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={invoice.client_name} size="sm" />
                        <span className="text-dark-200">{invoice.client_name}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-white">
                      ${invoice.total?.toLocaleString()}
                    </td>
                    <td>
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        statusOptions.find(s => s.value === invoice.status)?.color,
                        'text-white'
                      )}>
                        {statusOptions.find(s => s.value === invoice.status)?.label}
                      </span>
                    </td>
                    <td className="text-dark-400">
                      {invoice.due_date && format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                          className="p-2 hover:bg-dark-800 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4 text-dark-400" />
                        </button>
                        
                        {openMenuId === invoice.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 mt-1 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-20 py-1">
                              <button
                                onClick={() => { setShowViewModal(invoice); setOpenMenuId(null); }}
                                className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                              {isAdmin() && (
                                <>
                                  <button
                                    onClick={() => openEditModal(invoice)}
                                    className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                  </button>
                                  {invoice.status === 'draft' && (
                                    <button
                                      onClick={() => handleSend(invoice)}
                                      className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-dark-700 flex items-center gap-2"
                                    >
                                      <Send className="w-4 h-4" />
                                      Send Invoice
                                    </button>
                                  )}
                                  {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
                                    <button
                                      onClick={() => handleMarkPaid(invoice)}
                                      className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-dark-700 flex items-center gap-2"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Mark as Paid
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setDeleteConfirm(invoice); setOpenMenuId(null); }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description={isAdmin() ? "Create your first invoice to get started" : "Your invoices will appear here"}
            action={isAdmin() && (
              <button onClick={openNewModal} className="btn-primary">
                <Plus className="w-5 h-5" />
                New Invoice
              </button>
            )}
          />
        )}
      </div>

      {/* Create/Edit Invoice Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingInvoice ? 'Edit Invoice' : 'New Invoice'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
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
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                className="w-full"
              >
                <option value="">Select project...</option>
                {projects
                  .filter(p => !formData.client_id || p.client_id === formData.client_id)
                  .map(project => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Due Date *</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full"
              >
                {statusOptions.filter(s => s.value !== 'cancelled').map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-3">Line Items</label>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min="1"
                      className="w-full"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                      placeholder="Rate"
                      min="0"
                      step="0.01"
                      className="w-full"
                    />
                  </div>
                  <div className="w-32 py-2.5 text-right text-white">
                    ${((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toLocaleString()}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="p-2.5 text-dark-400 hover:text-red-400"
                    disabled={formData.items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="mt-3 text-sm text-brand-400 hover:text-brand-300"
            >
              + Add Line Item
            </button>
          </div>

          {/* Totals */}
          <div className="border-t border-dark-700 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-dark-300">
                  <span>Subtotal</span>
                  <span>${totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>Tax</span>
                  <span>${totals.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-white border-t border-dark-700 pt-2">
                  <span>Total</span>
                  <span>${totals.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full"
              placeholder="Payment terms, thank you message, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingInvoice ? 'Save Changes' : 'Create Invoice')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        isOpen={!!showViewModal}
        onClose={() => setShowViewModal(null)}
        title="Invoice Details"
        size="lg"
      >
        {showViewModal && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">{showViewModal.invoice_number}</h2>
                <p className="text-dark-400 mt-1">{showViewModal.client_name}</p>
              </div>
              <span className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium',
                statusOptions.find(s => s.value === showViewModal.status)?.color,
                'text-white'
              )}>
                {statusOptions.find(s => s.value === showViewModal.status)?.label}
              </span>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-dark-500">Issue Date</span>
                <p className="text-white">{format(parseISO(showViewModal.created_at), 'MMMM d, yyyy')}</p>
              </div>
              <div>
                <span className="text-dark-500">Due Date</span>
                <p className="text-white">{format(parseISO(showViewModal.due_date), 'MMMM d, yyyy')}</p>
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-dark-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-dark-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-dark-300">Description</th>
                    <th className="px-4 py-3 text-right text-sm text-dark-300">Qty</th>
                    <th className="px-4 py-3 text-right text-sm text-dark-300">Rate</th>
                    <th className="px-4 py-3 text-right text-sm text-dark-300">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(typeof showViewModal.items === 'string' ? JSON.parse(showViewModal.items) : (showViewModal.items || [])).map((item, index) => (
                    <tr key={index} className="border-t border-dark-700">
                      <td className="px-4 py-3 text-white">{item.description}</td>
                      <td className="px-4 py-3 text-right text-dark-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-dark-300">${item.rate}</td>
                      <td className="px-4 py-3 text-right text-white">${item.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-dark-300">
                  <span>Subtotal</span>
                  <span>${showViewModal.subtotal?.toLocaleString()}</span>
                </div>
                {showViewModal.tax_amount > 0 && (
                  <div className="flex justify-between text-dark-300">
                    <span>Tax</span>
                    <span>${showViewModal.tax_amount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-white border-t border-dark-700 pt-2">
                  <span>Total</span>
                  <span>${showViewModal.total?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {showViewModal.notes && (
              <div className="border-t border-dark-700 pt-4">
                <p className="text-sm text-dark-500 mb-1">Notes</p>
                <p className="text-dark-300">{showViewModal.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
              <button onClick={() => setShowViewModal(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice ${deleteConfirm?.invoice_number}?`}
        confirmText="Delete"
      />
    </div>
  );
}
