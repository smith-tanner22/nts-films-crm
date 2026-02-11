import { X, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import clsx from 'clsx';

// Modal Component
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className={clsx('modal', sizeClasses[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// Loading Spinner
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2 className={clsx('animate-spin text-brand-500', sizeClasses[size], className)} />
  );
}

// Full Page Loading
export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="xl" />
    </div>
  );
}

// Empty State
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-dark-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-dark-400 max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

// Status Badge
export function StatusBadge({ status, className = '' }) {
  const statusLabels = {
    // Lead statuses
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposal_sent: 'Proposal Sent',
    negotiating: 'Negotiating',
    converted: 'Converted',
    lost: 'Lost',
    // Project statuses
    inquiry: 'Inquiry',
    quote_sent: 'Quote Sent',
    contract_signed: 'Contract Signed',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    editing: 'Editing',
    review: 'Review',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    // Invoice statuses
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    paid: 'Paid',
    overdue: 'Overdue',
  };

  return (
    <span className={clsx(`badge-${status}`, className)}>
      {statusLabels[status] || status}
    </span>
  );
}

// Avatar
export function Avatar({ name, image, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={clsx('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  const initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={clsx(
      'rounded-full bg-brand-500 flex items-center justify-center font-semibold text-white',
      sizeClasses[size],
      className
    )}>
      {initials || '?'}
    </div>
  );
}

// Progress Bar
export function ProgressBar({ value, max = 100, className = '' }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={clsx('h-2 bg-dark-800 rounded-full overflow-hidden', className)}>
      <div
        className="h-full bg-brand-500 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Stat Card
export function StatCard({ icon: Icon, label, value, subtext, iconColor = 'bg-brand-500/20 text-brand-500' }) {
  return (
    <div className="stat-card flex items-start justify-between">
      <div>
        <p className="text-sm text-dark-400">{label}</p>
        <p className="stat-value mt-1">{value}</p>
        {subtext && <p className="stat-label">{subtext}</p>}
      </div>
      {Icon && (
        <div className={clsx('stat-icon', iconColor)}>
          <Icon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}

// Confirmation Dialog
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isLoading = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-dark-400">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={isLoading}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger" disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
