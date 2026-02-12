import { useState, useEffect } from 'react';
import { 
  User, Bell, Lock, Palette, Building, Mail, Phone, MapPin,
  Camera, Save, Eye, EyeOff, Check, X
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, PageLoading, LoadingSpinner, Avatar } from '../../components/ui';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const api = {
  updateProfile: (data) => fetch('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  changePassword: (data) => fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateNotificationSettings: (data) => fetch('/api/auth/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  getBusinessSettings: () => fetch('/api/settings/business', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  }).then(r => r.json()),
  updateBusinessSettings: (data) => fetch('/api/settings/business', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(data)
  }).then(r => r.json()),
};

export default function Settings() {
  const { user, isAdmin, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    email_new_lead: true,
    email_project_updates: true,
    email_invoice_paid: true,
    email_questionnaire_submitted: true,
    email_weekly_summary: false,
  });

  // Business settings (admin only)
  const [business, setBusiness] = useState({
    company_name: 'NTS Films',
    company_email: '',
    company_phone: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_zip: '',
    tax_rate: 0,
    payment_terms: 'Net 30',
    invoice_footer: '',
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
    if (isAdmin()) {
      loadBusinessSettings();
    }
  }, [user]);

  const loadBusinessSettings = async () => {
    try {
      const data = await api.getBusinessSettings();
      if (data.settings) {
        setBusiness(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Failed to load business settings');
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const result = await api.updateProfile(profile);
      if (result.error) {
        toast.error(result.error);
      } else {
        setUser({ ...user, ...profile });
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Password changed successfully');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      const result = await api.updateNotificationSettings(notifications);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Notification preferences saved');
      }
    } catch (error) {
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusinessSettings = async () => {
    setIsSaving(true);
    try {
      const result = await api.updateBusinessSettings(business);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Business settings saved');
      }
    } catch (error) {
      toast.error('Failed to save business settings');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(isAdmin() ? [{ id: 'business', label: 'Business', icon: Building }] : []),
  ];

  return (
    <div className="min-h-screen">
      <Header title="Settings" />
      
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-dark-800 pb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <Avatar name={profile.name} size="xl" />
                  <button className="absolute bottom-0 right-0 p-2 bg-brand-500 rounded-full text-white hover:bg-brand-600 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{profile.name}</h3>
                  <p className="text-dark-400">{isAdmin() ? 'Administrator' : 'Client'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full pl-10"
                      placeholder="Your name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-10"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full pl-10"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button onClick={handleSaveProfile} disabled={isSaving} className="btn-primary">
                  {isSaving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Change Password</h2>
              
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                      className="w-full pl-10 pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                      className="w-full pl-10 pr-10"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                      className="w-full pl-10 pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleChangePassword} 
                    disabled={isSaving || !passwordData.current_password || !passwordData.new_password}
                    className="btn-primary"
                  >
                    {isSaving ? <LoadingSpinner size="sm" /> : <><Lock className="w-4 h-4" /> Update Password</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Email Notifications</h2>
              
              <div className="space-y-4">
                {[
                  { key: 'email_new_lead', label: 'New Lead Received', description: 'Get notified when a new lead submits an inquiry' },
                  { key: 'email_project_updates', label: 'Project Updates', description: 'Notifications about project status changes' },
                  { key: 'email_invoice_paid', label: 'Invoice Paid', description: 'Get notified when a client pays an invoice' },
                  { key: 'email_questionnaire_submitted', label: 'Questionnaire Submitted', description: 'When a client completes a questionnaire' },
                  { key: 'email_weekly_summary', label: 'Weekly Summary', description: 'Receive a weekly summary of your business activity' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-dark-850 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-dark-400">{item.description}</p>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={clsx(
                        'relative w-12 h-6 rounded-full transition-colors',
                        notifications[item.key] ? 'bg-brand-500' : 'bg-dark-700'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                          notifications[item.key] ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-8">
                <button onClick={handleSaveNotifications} disabled={isSaving} className="btn-primary">
                  {isSaving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4" /> Save Preferences</>}
                </button>
              </div>
            </div>
          )}

          {/* Business Tab (Admin Only) */}
          {activeTab === 'business' && isAdmin() && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Business Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={business.company_name}
                    onChange={(e) => setBusiness(prev => ({ ...prev, company_name: e.target.value }))}
                    className="w-full"
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Business Email</label>
                  <input
                    type="email"
                    value={business.company_email}
                    onChange={(e) => setBusiness(prev => ({ ...prev, company_email: e.target.value }))}
                    className="w-full"
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Business Phone</label>
                  <input
                    type="tel"
                    value={business.company_phone}
                    onChange={(e) => setBusiness(prev => ({ ...prev, company_phone: e.target.value }))}
                    className="w-full"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">Street Address</label>
                  <input
                    type="text"
                    value={business.company_address}
                    onChange={(e) => setBusiness(prev => ({ ...prev, company_address: e.target.value }))}
                    className="w-full"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">City</label>
                  <input
                    type="text"
                    value={business.company_city}
                    onChange={(e) => setBusiness(prev => ({ ...prev, company_city: e.target.value }))}
                    className="w-full"
                    placeholder="City"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">State</label>
                    <input
                      type="text"
                      value={business.company_state}
                      onChange={(e) => setBusiness(prev => ({ ...prev, company_state: e.target.value }))}
                      className="w-full"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">ZIP Code</label>
                    <input
                      type="text"
                      value={business.company_zip}
                      onChange={(e) => setBusiness(prev => ({ ...prev, company_zip: e.target.value }))}
                      className="w-full"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>

              <hr className="my-8 border-dark-700" />

              <h3 className="text-md font-semibold text-white mb-4">Invoice Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    value={business.tax_rate}
                    onChange={(e) => setBusiness(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    className="w-full"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Payment Terms</label>
                  <select
                    value={business.payment_terms}
                    onChange={(e) => setBusiness(prev => ({ ...prev, payment_terms: e.target.value }))}
                    className="w-full"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">Invoice Footer Text</label>
                  <textarea
                    value={business.invoice_footer}
                    onChange={(e) => setBusiness(prev => ({ ...prev, invoice_footer: e.target.value }))}
                    className="w-full"
                    rows={3}
                    placeholder="Thank you for your business! Payment is due within 30 days..."
                  />
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button onClick={handleSaveBusinessSettings} disabled={isSaving} className="btn-primary">
                  {isSaving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4" /> Save Business Settings</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}