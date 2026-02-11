import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, MapPin, DollarSign, User, Mail, Phone,
  CheckCircle2, Circle, Plus, Upload, FileText, ExternalLink
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { StatusBadge, ProgressBar, PageLoading, Avatar, LoadingSpinner } from '../../components/ui';
import { projectsApi, uploadsApi } from '../../utils/api';
import { format } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ProjectDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuthStore();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await projectsApi.getOne(id);
      setProject(response.data.project);
      setTasks(response.data.tasks);
      setUploads(response.data.uploads);
    } catch (error) {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskToggle = async (taskId, completed) => {
    try {
      await projectsApi.updateTask(id, taskId, { completed: completed ? 1 : 0 });
      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, completed: completed ? 1 : 0 } : t
      ));
      toast.success(completed ? 'Task completed!' : 'Task marked incomplete');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('project_id', id);
    formData.append('category', 'general');

    try {
      await uploadsApi.upload(formData);
      toast.success('File uploaded!');
      loadProject();
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (!project) return <div className="p-6 text-center text-dark-400">Project not found</div>;

  const completedTasks = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen">
      <Header title={project.title} />
      
      <div className="p-6">
        <Link to="/projects" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info Card */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white mb-2">{project.title}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={project.status} />
                    <span className="text-dark-400">
                      {project.service_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {project.description && (
                <p className="text-dark-300 mb-6">{project.description}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {project.filming_date && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-dark-500">Filming</p>
                      <p className="text-white">{format(new Date(project.filming_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
                {project.delivery_date && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-dark-500">Delivery</p>
                      <p className="text-white">{format(new Date(project.delivery_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
                {project.filming_location && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-dark-500">Location</p>
                      <p className="text-white truncate">{project.filming_location}</p>
                    </div>
                  </div>
                )}
                {project.budget && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-dark-500">Budget</p>
                      <p className="text-white">${project.budget.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tasks/Milestones */}
            <div className="card">
              <div className="p-4 border-b border-dark-800">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">Project Milestones</h2>
                  <span className="text-sm text-dark-400">{completedTasks}/{tasks.length} completed</span>
                </div>
                <ProgressBar value={progress} className="mt-3" />
              </div>
              
              <div className="divide-y divide-dark-800">
                {tasks.map((task) => (
                  <div 
                    key={task.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 transition-colors',
                      task.completed ? 'bg-dark-850/50' : 'hover:bg-dark-850'
                    )}
                  >
                    {isAdmin() ? (
                      <button
                        onClick={() => handleTaskToggle(task.id, !task.completed)}
                        className={clsx(
                          'shrink-0 transition-colors',
                          task.completed ? 'text-green-500' : 'text-dark-500 hover:text-brand-500'
                        )}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>
                    ) : (
                      <div className={clsx('shrink-0', task.completed ? 'text-green-500' : 'text-dark-500')}>
                        {task.completed ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'font-medium',
                        task.completed ? 'text-dark-400 line-through' : 'text-white'
                      )}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-dark-500">{task.description}</p>
                      )}
                    </div>
                    {task.due_date && (
                      <span className="text-sm text-dark-500">
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div className="card">
              <div className="p-4 border-b border-dark-800 flex items-center justify-between">
                <h2 className="font-semibold text-white">Files</h2>
                <label className="btn-outline btn-sm cursor-pointer">
                  {uploading ? <LoadingSpinner size="sm" /> : <Upload className="w-4 h-4" />}
                  Upload
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              
              {uploads.length > 0 ? (
                <div className="divide-y divide-dark-800">
                  {uploads.map((file) => (
                    <div key={file.id} className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-dark-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{file.original_name}</p>
                        <p className="text-sm text-dark-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {format(new Date(file.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <a
                        href={`/uploads/${file.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-dark-400 hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-dark-500">
                  No files uploaded yet
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            <div className="card p-6">
              <h3 className="font-semibold text-white mb-4">Client</h3>
              <div className="flex items-center gap-4 mb-4">
                <Avatar name={project.client_name} size="lg" />
                <div>
                  <p className="font-medium text-white">{project.client_name}</p>
                  <p className="text-sm text-dark-400">Client</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-dark-300">
                  <Mail className="w-4 h-4 text-dark-500" />
                  <a href={`mailto:${project.client_email}`} className="hover:text-brand-400">
                    {project.client_email}
                  </a>
                </div>
                {project.client_phone && (
                  <div className="flex items-center gap-3 text-dark-300">
                    <Phone className="w-4 h-4 text-dark-500" />
                    <a href={`tel:${project.client_phone}`} className="hover:text-brand-400">
                      {project.client_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {isAdmin() && (
              <div className="card p-6">
                <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Link to={`/invoices?new=true&project=${id}`} className="btn-outline w-full justify-center">
                    <DollarSign className="w-4 h-4" />
                    Create Invoice
                  </Link>
                  <Link to={`/calendar?project=${id}`} className="btn-outline w-full justify-center">
                    <Calendar className="w-4 h-4" />
                    Schedule Event
                  </Link>
                </div>
              </div>
            )}

            {/* Notes */}
            {project.notes && (
              <div className="card p-6">
                <h3 className="font-semibold text-white mb-4">Notes</h3>
                <p className="text-dark-300 text-sm whitespace-pre-wrap">{project.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
