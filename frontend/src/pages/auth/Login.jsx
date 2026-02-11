import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { LoadingSpinner } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-dark-900 to-dark-950 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-brand-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-600 rounded-full filter blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.png" alt="NTS Films" className="w-14 h-14" />
            <span className="text-3xl font-display font-bold text-white">NTS Films</span>
          </div>
          
          <h1 className="text-4xl font-display font-bold text-white leading-tight mb-6">
            Professional Videography<br />
            <span className="text-brand-400">CRM & Client Portal</span>
          </h1>
          
          <p className="text-lg text-dark-300 max-w-md">
            Manage leads, clients, projects, and invoices all in one place. 
            Streamline your videography business with powerful automation.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: 'Lead Management', desc: 'Capture & convert' },
              { label: 'Project Tracking', desc: 'From inquiry to delivery' },
              { label: 'Client Portal', desc: 'Self-service access' },
              { label: 'Invoicing', desc: 'Get paid faster' },
            ].map((feature) => (
              <div key={feature.label} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700">
                <p className="font-medium text-white">{feature.label}</p>
                <p className="text-sm text-dark-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-dark-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/logo.png" alt="NTS Films" className="w-12 h-12" />
            <span className="text-2xl font-display font-bold text-white">NTS Films</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-white">Welcome back</h2>
            <p className="text-dark-400 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500" />
                <span className="text-sm text-dark-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-dark-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Create account
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-dark-900 rounded-xl border border-dark-800">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Demo Credentials</p>
            <p className="text-sm text-dark-300">
              <span className="text-dark-500">Admin:</span> admin@ntsfilms.com / admin123
            </p>
            <p className="text-sm text-dark-300">
              <span className="text-dark-500">Client:</span> emily@example.com / client123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
