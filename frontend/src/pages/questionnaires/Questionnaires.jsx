import { useState, useEffect } from 'react';
import { 
  Plus, Search, FileQuestion, MoreVertical, Edit, Trash2, Send, Link, 
  Copy, Eye, CheckCircle, Clock, ChevronDown, ChevronUp, GripVertical
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, PageLoading, EmptyState, ConfirmDialog, LoadingSpinner, Avatar } from '../../components/ui';
import { questionnairesApi, clientsApi, projectsApi } from '../../utils/api';
import { format, parseISO } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const questionTypes = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
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

export default function Questionnaires() {
  const { isAdmin } = useAuthStore();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [responses, setResponses] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');
  const [showModal, setShowModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(null);
  const [showSendModal, setShowSendModal] = useState(null);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    service_type: '',
    questions: [{ id: '1', type: 'text', question: '', required: false, options: [] }],
  });

  const [sendData, setSendData] = useState({
    client_id: '',
    project_id: '',
    email: '',
  });

  useEffect(() => {
    loadQuestionnaires();
    if (isAdmin()) {
      loadClients();
    }
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await questionnairesApi.getAll();
      setQuestionnaires(response.data.questionnaires || []);
      setResponses(response.data.responses || []);
    } catch (error) {
      toast.error('Failed to load questionnaires');
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
    setEditingQuestionnaire(null);
    setFormData({
      title: '',
      description: '',
      service_type: '',
      questions: [{ id: Date.now().toString(), type: 'text', question: '', required: false, options: [] }],
    });
    setShowModal(true);
  };

  const openEditModal = (questionnaire) => {
    setEditingQuestionnaire(questionnaire);
    setFormData({
      title: questionnaire.title,
      description: questionnaire.description || '',
      service_type: questionnaire.service_type || '',
      questions: JSON.parse(questionnaire.questions || '[]'),
    });
    setShowModal(true);
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: Date.now().toString(), type: 'text', question: '', required: false, options: [] }
      ]
    }));
  };

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) return;
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const addOption = (questionIndex) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, options: [...(q.options || []), ''] }
          : q
      )
    }));
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, options: q.options.map((o, oi) => oi === optionIndex ? value : o) }
          : q
      )
    }));
  };

  const removeOption = (questionIndex, optionIndex) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, options: q.options.filter((_, oi) => oi !== optionIndex) }
          : q
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // Prepare questions - ensure each has required fields
    const preparedQuestions = formData.questions.map((q, index) => ({
      id: q.id || String(Date.now() + index),
      type: q.type || 'text',
      question: q.question || `Question ${index + 1}`,
      required: q.required || false,
      options: q.options || []
    }));

    const submitData = {
      title: formData.title,
      description: formData.description,
      service_type: formData.service_type,
      questions: preparedQuestions, // Send as array, backend handles both
    };

    console.log('Submitting questionnaire:', submitData);

    try {
      if (editingQuestionnaire) {
        await questionnairesApi.update(editingQuestionnaire.id, submitData);
        toast.success('Questionnaire updated');
      } else {
        await questionnairesApi.create(submitData);
        toast.success('Questionnaire created');
      }
      setShowModal(false);
      loadQuestionnaires();
    } catch (error) {
      console.error('Questionnaire error:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to save questionnaire');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await questionnairesApi.delete(deleteConfirm.id);
      toast.success('Questionnaire deleted');
      setDeleteConfirm(null);
      loadQuestionnaires();
    } catch (error) {
      toast.error('Failed to delete questionnaire');
    }
  };

  const handleGenerateLink = async (questionnaire) => {
    try {
      const response = await questionnairesApi.generateLink(questionnaire.id, sendData);
      const link = `${window.location.origin}/questionnaire/${response.data.token}`;
      
      await navigator.clipboard.writeText(link);
      setCopiedLink(questionnaire.id);
      toast.success('Link copied to clipboard!');
      
      setTimeout(() => setCopiedLink(null), 3000);
      setShowSendModal(null);
    } catch (error) {
      toast.error('Failed to generate link');
    }
  };

  const getResponsesForQuestionnaire = (questionnaireId) => {
    return responses.filter(r => r.questionnaire_id === questionnaireId);
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Questionnaires" />
      
      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('templates')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'templates'
                  ? 'bg-brand-500 text-white'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              )}
            >
              Templates ({questionnaires.length})
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'responses'
                  ? 'bg-brand-500 text-white'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              )}
            >
              Responses ({responses.length})
            </button>
          </div>

          {isAdmin() && activeTab === 'templates' && (
            <button onClick={openNewModal} className="btn-primary">
              <Plus className="w-5 h-5" />
              New Questionnaire
            </button>
          )}
        </div>

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <>
            {questionnaires.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {questionnaires.map((q) => {
                  const questionCount = JSON.parse(q.questions || '[]').length;
                  const responseCount = getResponsesForQuestionnaire(q.id).length;
                  
                  return (
                    <div key={q.id} className="card-hover p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                            <FileQuestion className="w-5 h-5 text-brand-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{q.title}</h3>
                            {q.service_type && (
                              <span className="text-xs text-dark-400">
                                {serviceTypes.find(s => s.value === q.service_type)?.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {q.description && (
                        <p className="text-sm text-dark-400 mb-4 line-clamp-2">{q.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-dark-500 mb-4">
                        <span>{questionCount} questions</span>
                        <span>{responseCount} responses</span>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-dark-800">
                        <button
                          onClick={() => setShowSendModal(q)}
                          className="btn-outline btn-sm flex-1"
                        >
                          <Link className="w-4 h-4" />
                          {copiedLink === q.id ? 'Copied!' : 'Get Link'}
                        </button>
                        {isAdmin() && (
                          <>
                            <button
                              onClick={() => openEditModal(q)}
                              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(q)}
                              className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="No questionnaires yet"
                description="Create questionnaire templates for leads and clients"
                action={isAdmin() && (
                  <button onClick={openNewModal} className="btn-primary">
                    <Plus className="w-5 h-5" />
                    New Questionnaire
                  </button>
                )}
              />
            )}
          </>
        )}

        {/* Responses Tab */}
        {activeTab === 'responses' && (
          <>
            {responses.length > 0 ? (
              <div className="card overflow-hidden">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Questionnaire</th>
                      <th>Submitted By</th>
                      <th>Project</th>
                      <th>Date</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((response) => (
                      <tr key={response.id}>
                        <td>
                          <span className="font-medium text-white">{response.questionnaire_title}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar name={response.client_name || response.lead_name || 'Anonymous'} size="sm" />
                            <span className="text-dark-200">{response.client_name || response.lead_name || 'Anonymous'}</span>
                          </div>
                        </td>
                        <td className="text-dark-400">
                          {response.project_title || '-'}
                        </td>
                        <td className="text-dark-400">
                          {format(parseISO(response.submitted_at), 'MMM d, yyyy')}
                        </td>
                        <td>
                          <button
                            onClick={() => setShowResponseModal(response)}
                            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle}
                title="No responses yet"
                description="Responses will appear here when clients complete questionnaires"
              />
            )}
          </>
        )}
      </div>

      {/* Create/Edit Questionnaire Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingQuestionnaire ? 'Edit Questionnaire' : 'New Questionnaire'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-300 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="e.g., Wedding Video Questionnaire"
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                placeholder="Help us capture your special day perfectly..."
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
                <option value="">All services</option>
                {serviceTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Questions */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-3">Questions</label>
            <div className="space-y-4">
              {formData.questions.map((question, index) => (
                <div key={question.id} className="p-4 bg-dark-850 rounded-lg border border-dark-700">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-xs text-dark-400 mt-2">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                          placeholder="Enter your question..."
                          className="flex-1"
                        />
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                          className="w-40"
                        >
                          {questionTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Options for select/checkbox/radio */}
                      {['select', 'checkbox', 'radio'].includes(question.type) && (
                        <div className="space-y-2 pl-4">
                          <label className="text-xs text-dark-500">Options</label>
                          {(question.options || []).map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(index, optIndex, e.target.value)}
                                placeholder={`Option ${optIndex + 1}`}
                                className="flex-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(index, optIndex)}
                                className="p-2 text-dark-500 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(index)}
                            className="text-sm text-brand-400 hover:text-brand-300"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500"
                        />
                        <span className="text-sm text-dark-400">Required</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      disabled={formData.questions.length === 1}
                      className="p-2 text-dark-500 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="mt-3 text-sm text-brand-400 hover:text-brand-300"
            >
              + Add Question
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingQuestionnaire ? 'Save Changes' : 'Create Questionnaire')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send/Get Link Modal */}
      <Modal
        isOpen={!!showSendModal}
        onClose={() => setShowSendModal(null)}
        title="Get Questionnaire Link"
      >
        {showSendModal && (
          <div className="space-y-4">
            <p className="text-dark-300">
              Generate a shareable link for "{showSendModal.title}". 
              Optionally assign it to a client or project.
            </p>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Client (optional)</label>
              <select
                value={sendData.client_id}
                onChange={(e) => setSendData(prev => ({ ...prev, client_id: e.target.value }))}
                className="w-full"
              >
                <option value="">No client - anonymous link</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowSendModal(null)} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={() => handleGenerateLink(showSendModal)} 
                className="btn-primary"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Response Modal */}
      <Modal
        isOpen={!!showResponseModal}
        onClose={() => setShowResponseModal(null)}
        title="Questionnaire Response"
        size="lg"
      >
        {showResponseModal && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{showResponseModal.questionnaire_title}</h3>
                <p className="text-sm text-dark-400">
                  Submitted by {showResponseModal.client_name || showResponseModal.lead_name || 'Anonymous'} on{' '}
                  {format(parseISO(showResponseModal.submitted_at), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(JSON.parse(showResponseModal.responses || '{}')).map(([questionId, answer], index) => (
                <div key={questionId} className="p-4 bg-dark-850 rounded-lg">
                  <p className="text-sm text-dark-400 mb-1">Question {index + 1}</p>
                  <p className="text-white font-medium mb-2">{questionId}</p>
                  <p className="text-dark-200">
                    {Array.isArray(answer) ? answer.join(', ') : answer || '-'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-dark-700">
              <button onClick={() => setShowResponseModal(null)} className="btn-secondary">
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
        title="Delete Questionnaire"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This will also delete all responses.`}
        confirmText="Delete"
      />
    </div>
  );
}
