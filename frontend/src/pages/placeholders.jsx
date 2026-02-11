// Placeholder pages - these can be expanded later

import Header from '../components/layout/Header';
import { EmptyState } from '../components/ui';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Header title="Settings" />
      <div className="p-6">
        <EmptyState
          icon={Settings}
          title="Settings"
          description="Manage your account settings and preferences. Full functionality coming soon."
        />
      </div>
    </div>
  );
}
