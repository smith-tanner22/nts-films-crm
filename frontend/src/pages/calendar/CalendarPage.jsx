import { useState, useEffect } from 'react';
import { 
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, User, MoreVertical, Edit, Trash2, X
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, PageLoading, EmptyState, ConfirmDialog, LoadingSpinner, Avatar } from '../../components/ui';
import { calendarApi, clientsApi, projectsApi } from '../../utils/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const eventTypes = [
  { value: 'filming', label: 'Filming', color: 'bg-brand-500' },
  { value: 'consultation', label: 'Consultation', color: 'bg-purple-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-blue-500' },
  { value: 'editing', label: 'Editing Session', color: 'bg-green-500' },
  { value: 'delivery', label: 'Delivery', color: 'bg-yellow-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

export default function CalendarPage() {
  const { isAdmin } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'filming',
    client_id: '',
    project_id: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '17:00',
    location: '',
    description: '',
    all_day: false,
  });

  useEffect(() => {
    loadEvents();
    if (isAdmin()) {
      loadClients();
      loadProjects();
    }
  }, [currentDate]);

  const loadEvents = async () => {
    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const response = await calendarApi.getAll({ start, end });
      setEvents(response.data.events);
    } catch (error) {
      toast.error('Failed to load events');
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

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days for the start of the month
    const startDay = start.getDay();
    const paddingDays = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(start);
      date.setDate(date.getDate() - (i + 1));
      paddingDays.push({ date, isCurrentMonth: false });
    }
    
    return [
      ...paddingDays,
      ...days.map(date => ({ date, isCurrentMonth: true }))
    ];
  };

  const getEventsForDay = (date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_date);
      return isSameDay(eventDate, date);
    });
  };

  const openNewModal = (date = null) => {
    setEditingEvent(null);
    const dateStr = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setFormData({
      title: '',
      event_type: 'filming',
      client_id: '',
      project_id: '',
      start_date: dateStr,
      start_time: '09:00',
      end_date: dateStr,
      end_time: '17:00',
      location: '',
      description: '',
      all_day: false,
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      client_id: event.client_id || '',
      project_id: event.project_id || '',
      start_date: event.start_date,
      start_time: event.start_time || '09:00',
      end_date: event.end_date || event.start_date,
      end_time: event.end_time || '17:00',
      location: event.location || '',
      description: event.description || '',
      all_day: event.all_day || false,
    });
    setShowEventDetail(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingEvent) {
        await calendarApi.update(editingEvent.id, formData);
        toast.success('Event updated');
      } else {
        await calendarApi.create(formData);
        toast.success('Event created');
      }
      setShowModal(false);
      loadEvents();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await calendarApi.delete(deleteConfirm.id);
      toast.success('Event deleted');
      setDeleteConfirm(null);
      setShowEventDetail(null);
      loadEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const days = getDaysInMonth();

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen">
      <Header title="Calendar" />
      
      <div className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-display font-bold text-white">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-dark-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm text-dark-300 hover:bg-dark-800 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-dark-400" />
              </button>
            </div>
          </div>

          {isAdmin() && (
            <button onClick={() => openNewModal()} className="btn-primary">
              <Plus className="w-5 h-5" />
              Add Event
            </button>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-dark-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="px-4 py-3 text-center text-sm font-medium text-dark-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {days.map(({ date, isCurrentMonth }, index) => {
              const dayEvents = getEventsForDay(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              
              return (
                <div
                  key={index}
                  onClick={() => isAdmin() && openNewModal(date)}
                  className={clsx(
                    'min-h-[120px] p-2 border-b border-r border-dark-800 transition-colors',
                    isCurrentMonth ? 'bg-dark-900' : 'bg-dark-950',
                    isAdmin() && 'cursor-pointer hover:bg-dark-850'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 flex items-center justify-center rounded-full text-sm mb-1',
                    isToday(date) && 'bg-brand-500 text-white',
                    !isToday(date) && isCurrentMonth && 'text-white',
                    !isToday(date) && !isCurrentMonth && 'text-dark-600'
                  )}>
                    {format(date, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => {
                      const eventType = eventTypes.find(t => t.value === event.event_type);
                      return (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEventDetail(event);
                          }}
                          className={clsx(
                            'w-full text-left px-2 py-1 rounded text-xs text-white truncate',
                            eventType?.color || 'bg-gray-500'
                          )}
                        >
                          {event.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-dark-400 pl-2">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Upcoming Events</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events
              .filter(e => parseISO(e.start_date) >= new Date())
              .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))
              .slice(0, 6)
              .map(event => {
                const eventType = eventTypes.find(t => t.value === event.event_type);
                return (
                  <div
                    key={event.id}
                    onClick={() => setShowEventDetail(event)}
                    className="card-hover p-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx('w-1 h-full rounded-full self-stretch', eventType?.color)} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{event.title}</h4>
                        <p className="text-sm text-dark-400 mt-1">
                          {format(parseISO(event.start_date), 'EEE, MMM d')}
                          {event.start_time && ` at ${event.start_time}`}
                        </p>
                        {event.location && (
                          <p className="text-sm text-dark-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </p>
                        )}
                        {event.client_name && (
                          <p className="text-sm text-dark-500 flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {event.client_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          
          {events.filter(e => parseISO(e.start_date) >= new Date()).length === 0 && (
            <div className="text-center py-8 text-dark-500">
              No upcoming events
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Event Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              placeholder="e.g., Johnson Wedding Filming"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Event Type</label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData(prev => ({ ...prev, event_type: e.target.value }))}
                className="w-full"
              >
                {eventTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Client</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                className="w-full"
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full"
                disabled={formData.all_day}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full"
                disabled={formData.all_day}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.all_day}
              onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500"
            />
            <span className="text-sm text-dark-300">All day event</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Phoenix Botanical Gardens"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <LoadingSpinner size="sm" /> : (editingEvent ? 'Save Changes' : 'Create Event')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Detail Modal */}
      <Modal
        isOpen={!!showEventDetail}
        onClose={() => setShowEventDetail(null)}
        title="Event Details"
      >
        {showEventDetail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{showEventDetail.title}</h3>
                <span className={clsx(
                  'inline-block px-2 py-1 rounded text-xs text-white mt-2',
                  eventTypes.find(t => t.value === showEventDetail.event_type)?.color
                )}>
                  {eventTypes.find(t => t.value === showEventDetail.event_type)?.label}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-dark-300">
                <CalendarIcon className="w-4 h-4 text-dark-500" />
                <span>
                  {format(parseISO(showEventDetail.start_date), 'EEEE, MMMM d, yyyy')}
                  {showEventDetail.start_time && ` at ${showEventDetail.start_time}`}
                  {showEventDetail.end_time && ` - ${showEventDetail.end_time}`}
                </span>
              </div>

              {showEventDetail.location && (
                <div className="flex items-center gap-3 text-dark-300">
                  <MapPin className="w-4 h-4 text-dark-500" />
                  <span>{showEventDetail.location}</span>
                </div>
              )}

              {showEventDetail.client_name && (
                <div className="flex items-center gap-3 text-dark-300">
                  <User className="w-4 h-4 text-dark-500" />
                  <span>{showEventDetail.client_name}</span>
                </div>
              )}
            </div>

            {showEventDetail.description && (
              <div className="pt-4 border-t border-dark-700">
                <p className="text-dark-300 whitespace-pre-wrap">{showEventDetail.description}</p>
              </div>
            )}

            {isAdmin() && (
              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => setDeleteConfirm(showEventDetail)}
                  className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => openEditModal(showEventDetail)}
                  className="btn-primary"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
