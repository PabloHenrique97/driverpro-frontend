import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { UserRole, AppNotification } from './types';
import { AdminDashboard } from './pages/Admin';
import { DriverDashboard } from './pages/Driver';
import { SolicitorDashboard } from './pages/Solicitor';
import { LogOut, LayoutDashboard, Truck, Lock, User, Bell, CheckCircle, Info, AlertTriangle, X, FilePlus, Eye, EyeOff, Users, Car, Video, Plus, ClipboardList, Search } from 'lucide-react';
import { ChatBot } from './components/ChatBot';

interface ToastItemProps {
  notification: AppNotification;
  onClose: (id: string) => void;
}

// Componente individual para gerenciar o tempo de vida de cada notificação
const ToastItem: React.FC<ToastItemProps> = ({ notification, onClose }) => {
  useEffect(() => {
    // Fecha automaticamente após 30 segundos (30000 ms)
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 30000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  return (
    <div 
      className={`pointer-events-auto transform transition-all duration-500 ease-in-out bg-white p-4 rounded-lg shadow-xl border-l-4 flex gap-3 items-start animate-in slide-in-from-right fade-in
        ${notification.type === 'success' ? 'border-green-500' : notification.type === 'warning' ? 'border-amber-500' : 'border-blue-500'}
      `}
    >
      <div className="mt-0.5">
        {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
        {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
        {notification.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-sm">{notification.title}</h4>
        <p className="text-slate-600 text-xs mt-1 leading-relaxed">{notification.message}</p>
        <p className="text-slate-400 text-[10px] mt-2 text-right">{new Date(notification.timestamp).toLocaleTimeString()}</p>
      </div>
      <button 
        onClick={() => onClose(notification.id)}
        className="text-slate-400 hover:text-slate-600 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const ToastContainer = () => {
  const { notifications, currentUser, markNotificationAsRead } = useApp();
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);

  // Filter unread notifications for the current user
  const myNotifications = notifications.filter(
    n => n.userId === currentUser?.id && !n.read
  );

  useEffect(() => {
    // When new notifications arrive, add them to visible list
    const newIds = myNotifications.map(n => n.id);
    setVisibleToasts(prev => Array.from(new Set([...prev, ...newIds])));
  }, [notifications, currentUser]);

  const handleClose = (id: string) => {
    markNotificationAsRead(id);
    setVisibleToasts(prev => prev.filter(t => t !== id));
  };

  if (!currentUser || myNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-80 pointer-events-none">
      {myNotifications.map(n => (
        <ToastItem key={n.id} notification={n} onClose={handleClose} />
      ))}
    </div>
  );
};

const LoginScreen = () => {
  const { login } = useApp();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(cpf, password);
    if (!success) {
        setError('CPF ou senha incorretos.');
    } else {
        setError('');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-900 overflow-hidden">
      {/* Background Image & Overlay covering full screen */}
      <div className="absolute inset-0 z-0">
         <img 
          src="https://images.unsplash.com/photo-1622675363311-ac97f3a9a525?q=80&w=2070&auto=format&fit=crop" 
          alt="Gestão de Rotas e Pedidos" 
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        {/* Unified Navy Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-900/80" />
      </div>
      
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md p-6">
           {/* Branding Header */}
           <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500 rounded-2xl mb-6 shadow-2xl shadow-yellow-500/20 transform rotate-3 hover:rotate-0 transition duration-300 ring-4 ring-yellow-500/10">
                    <Truck className="w-10 h-10 text-slate-900" />
                </div>
                <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight drop-shadow-lg">
                    Gestão de Demanda <br/> <span className="text-yellow-400">Inteligente</span>
                </h1>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs font-bold tracking-widest text-slate-500 uppercase">
                    <span className="w-8 h-[1px] bg-slate-700"></span>
                    DriverPro System v1.0.5
                    <span className="w-8 h-[1px] bg-slate-700"></span>
                </div>
           </div>

           {/* Login Card - Glassmorphism */}
           <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
               <div className="text-center mb-8">
                   <h2 className="text-xl font-bold text-white mb-1">Acesso ao Sistema</h2>
                   <p className="text-slate-400 text-sm">Entre com suas credenciais</p>
               </div>

               <form onSubmit={handleLogin} className="space-y-5">
                   {/* Error Alert */}
                   {error && (
                        <div className="bg-red-500/10 text-red-200 text-sm p-3 rounded-xl border border-red-500/20 text-center flex items-center justify-center gap-2 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                   )}

                   {/* Inputs with dark theme styling */}
                   <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">CPF</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-yellow-400 transition" />
                            <input 
                                type="text" 
                                placeholder="000.000.000-00"
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition text-white placeholder-slate-600 shadow-inner"
                                value={cpf}
                                onChange={(e) => setCpf(e.target.value)}
                            />
                        </div>
                   </div>

                   <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Senha</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-yellow-400 transition" />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="******"
                                className="w-full pl-12 pr-12 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition text-white placeholder-slate-600 shadow-inner"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                   </div>

                   <button 
                        type="submit" 
                        className="w-full bg-yellow-500 text-slate-900 py-4 rounded-xl font-bold hover:bg-yellow-400 transition-all duration-300 shadow-lg shadow-yellow-500/20 mt-6 active:scale-[0.98] transform flex items-center justify-center gap-2"
                    >
                        <span>Entrar na Plataforma</span>
                        <Truck className="w-5 h-5" />
                    </button>
               </form>
           </div>
           
           <div className="mt-8 text-center opacity-60">
                <p className="text-xs text-slate-500">© 2025 DriverPro. Todos os direitos reservados.</p>
           </div>
      </div>
    </div>
  );
};

const MainLayout = () => {
    const { currentUser, logout, notifications } = useApp();
    // Updated types for new menu items
    const [currentView, setCurrentView] = useState<'dashboard' | 'create-request' | 'requests' | 'users' | 'vehicles' | 'marketing' | 'reports' | 'fleet-monitor'>('dashboard');

    useEffect(() => {
        // Set default view based on role
        if (currentUser?.role === UserRole.DRIVER) return;
        if (currentUser?.role === UserRole.SOLICITOR) setCurrentView('requests');
        if (currentUser?.role === UserRole.ADMIN) setCurrentView('dashboard');
        // SOLICITOR_ADMIN defaults to Create Request for quick access as per requirements
        if (currentUser?.role === UserRole.SOLICITOR_ADMIN) setCurrentView('create-request');
    }, [currentUser]);

    if (!currentUser) return <LoginScreen />;

    // Count unread notifications for badge
    const unreadCount = notifications.filter(n => n.userId === currentUser.id && !n.read).length;

    // Permissions
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const isSolicitor = currentUser.role === UserRole.SOLICITOR;
    const isSolicitorAdmin = currentUser.role === UserRole.SOLICITOR_ADMIN;

    const showAdminLink = isAdmin || isSolicitorAdmin;
    const showSolicitorLink = isSolicitor || isSolicitorAdmin;

    // Helper to determine active state styling
    const getLinkClass = (viewName: string) => 
        `flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition text-left w-full
        ${currentView === viewName ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative overflow-hidden">
            
            {/* Background Texture for Inner Pages */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]">
                <img 
                    src="https://images.unsplash.com/photo-1577083288073-40892c0860a4?q=80&w=2070&auto=format&fit=crop" 
                    alt="Map Texture" 
                    className="w-full h-full object-cover"
                />
            </div>

            <ToastContainer />

            {/* Sidebar / Navbar */}
            <nav className="bg-white/95 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-64 flex-shrink-0 flex md:flex-col justify-between p-4 sticky top-0 md:h-screen z-40 shadow-sm">
                <div className="flex items-center gap-2 md:mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                        <Truck className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-xl text-slate-800 tracking-tight">DriverPro</span>
                </div>

                {/* Mobile Menu */}
                <div className="flex md:hidden items-center gap-3 mx-4">
                     {/* For Solicitor Admin/Solicitor, show Create Request first in mobile too */}
                     {showSolicitorLink && (
                        <>
                         <button 
                             onClick={() => setCurrentView('create-request')}
                             className={`p-2 rounded-lg transition ${currentView === 'create-request' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'text-slate-400 hover:bg-slate-100'}`}
                         >
                             <Plus className="w-6 h-6" />
                         </button>
                         <button 
                             onClick={() => setCurrentView('requests')}
                             className={`p-2 rounded-lg transition ${currentView === 'requests' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'text-slate-400 hover:bg-slate-100'}`}
                         >
                             <FilePlus className="w-6 h-6" />
                         </button>
                        </>
                     )}
                     {showAdminLink && (
                        <>
                             <button 
                                 onClick={() => setCurrentView('dashboard')}
                                 className={`p-2 rounded-lg transition ${currentView === 'dashboard' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'text-slate-400 hover:bg-slate-100'}`}
                             >
                                 <LayoutDashboard className="w-6 h-6" />
                             </button>
                        </>
                     )}
                </div>

                {/* Desktop Menu */}
                <div className="hidden md:flex flex-col gap-1">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</div>
                    
                    {/* Logic for Solicitor + Admin: Show Request buttons first */}
                    {(isSolicitor || isSolicitorAdmin) && (
                        <>
                            <button onClick={() => setCurrentView('create-request')} className={getLinkClass('create-request')}>
                                <Plus className="w-4 h-4" />
                                Nova Solicitação
                            </button>
                            <button onClick={() => setCurrentView('requests')} className={getLinkClass('requests')}>
                                <FilePlus className="w-4 h-4" />
                                Minhas Solicitações
                            </button>
                            <button onClick={() => setCurrentView('fleet-monitor')} className={getLinkClass('fleet-monitor')}>
                                <Search className="w-4 h-4" />
                                Monitoramento
                            </button>
                            <div className="my-2 border-t border-slate-100" />
                        </>
                    )}

                    {/* Admin Links */}
                    {showAdminLink && (
                        <>
                            <button onClick={() => setCurrentView('dashboard')} className={getLinkClass('dashboard')}>
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </button>
                            
                            <button onClick={() => setCurrentView('users')} className={getLinkClass('users')}>
                                <Users className="w-4 h-4" />
                                Usuários
                            </button>
                            
                            <button onClick={() => setCurrentView('vehicles')} className={getLinkClass('vehicles')}>
                                <Car className="w-4 h-4" />
                                Veículos
                            </button>

                            <button onClick={() => setCurrentView('reports')} className={getLinkClass('reports')}>
                                <ClipboardList className="w-4 h-4" />
                                Relatórios
                            </button>

                            <button onClick={() => setCurrentView('marketing')} className={getLinkClass('marketing')}>
                                <Video className="w-4 h-4" />
                                Marketing
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3 md:mt-auto pt-4 border-t border-slate-100 w-full justify-end md:justify-start">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm">
                            {currentUser.name.charAt(0)}
                        </div>
                        {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        )}
                    </div>
                    <div className="hidden md:block flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-slate-800 truncate">{currentUser.name}</p>
                        <p className="text-xs text-slate-500 truncate capitalize">
                            {currentUser.role === UserRole.SOLICITOR_ADMIN ? 'Admin/Solicitante' : currentUser.role.toLowerCase()}
                        </p>
                    </div>
                    <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition" title="Sair">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </nav>

            {/* Content Area */}
            <main className="flex-1 overflow-auto relative z-10">
                {currentUser.role === UserRole.DRIVER && <DriverDashboard />}
                
                {/* Router Logic for Admin/Solicitor/Hybrid */}
                {currentUser.role !== UserRole.DRIVER && (
                    <>
                        {(currentView === 'requests' || currentView === 'create-request' || currentView === 'fleet-monitor') ? <SolicitorDashboard view={currentView} /> : <AdminDashboard view={currentView as any} />}
                    </>
                )}
            </main>

            {/* AI Chatbot Floating Component */}
            <ChatBot />
        </div>
    );
};

const App = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;