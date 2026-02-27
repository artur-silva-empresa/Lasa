
import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Clock, 
  Settings, 
  Upload, 
  Bell, 
  User as UserIcon, 
  Menu, 
  X,
  LogOut,
  Layers,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { User, Order } from '../types';
import { SECTORS } from '../constants';
import { formatDate } from '../utils/formatters';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  setActiveView: (view: string) => void;
  onImportClick: () => void;
  alertCount: number;
  user: User | null;
  onLogout: () => void;
  orders: Order[];
  onViewDetails: (order: Order) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setActiveView, onImportClick, alertCount, user, onLogout, orders, onViewDetails }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [isSectorsOpen, setIsSectorsOpen] = React.useState(false);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

  // Itens dinâmicos baseados em permissões
  const menuItems = React.useMemo(() => {
    const items = [];
    if (user?.permissions?.dashboard !== 'none') {
        items.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
    }
    if (user?.permissions?.orders !== 'none') {
        items.push({ id: 'orders', label: 'Encomendas', icon: Package });
    }
    if (user?.permissions?.timeline !== 'none') {
        items.push({ id: 'timeline', label: 'Timeline', icon: Clock });
    }
    return items;
  }, [user]);

  const visibleSectors = React.useMemo(() => {
    const sectors = user?.permissions?.sectors || {};
    return SECTORS.filter(s => sectors[s.id] && sectors[s.id] !== 'none');
  }, [user]);

  const hasConfigAccess = user?.permissions?.config !== 'none' || user?.permissions?.stopReasons !== 'none';

  const handleSectorClick = (sectorId: string) => {
    setActiveView(`sector-${sectorId}`);
  };

  return (
    <div className="flex h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden flex-col md:flex-row w-full transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 dark:bg-slate-900 text-white transition-all duration-300 ease-in-out flex-col z-50 shrink-0`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg shrink-0">TF</div>
          {isSidebarOpen && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
                <span className="font-bold text-xl tracking-tight overflow-hidden whitespace-nowrap">TexFlow</span>
            </div>
          )}
        </div>

        <nav className="flex-1 mt-6 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    activeView === item.id || (item.id === 'orders' && activeView === 'order-details')
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon size={20} />
                  {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                </button>
              </li>
            ))}

            {/* Sectores Dropdown */}
            <li>
              <button
                onClick={() => setIsSectorsOpen(!isSectorsOpen)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  activeView.startsWith('sector-')
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Layers size={20} />
                  {isSidebarOpen && <span className="font-medium whitespace-nowrap">Sectores</span>}
                </div>
                {isSidebarOpen && (
                  isSectorsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Submenu Sectores */}
              {isSectorsOpen && isSidebarOpen && visibleSectors.length > 0 && (
                <ul className="mt-1 ml-4 space-y-1 border-l border-slate-700 pl-2 animate-in slide-in-from-top-2 duration-200">
                  {visibleSectors.map((sector) => {
                    const SectorIcon = sector.icon;
                    const isActive = activeView === `sector-${sector.id}`;
                    return (
                      <li key={sector.id}>
                        <button
                          onClick={() => handleSectorClick(sector.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'text-blue-400 bg-slate-800/50 font-bold' 
                              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                          }`}
                        >
                          <SectorIcon size={16} />
                          <span>{sector.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>

            {/* Configurações Dropdown */}
            {hasConfigAccess && (
              <li>
                <button
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeView === 'config' || activeView === 'stop-reasons'
                      ? 'text-white bg-slate-800' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Settings size={20} />
                    {isSidebarOpen && <span className="font-medium whitespace-nowrap">Configurações</span>}
                  </div>
                  {isSidebarOpen && (
                    isConfigOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </button>

                {/* Submenu Configurações */}
                {isConfigOpen && isSidebarOpen && (
                  <ul className="mt-1 ml-4 space-y-1 border-l border-slate-700 pl-2 animate-in slide-in-from-top-2 duration-200">
                    {user?.permissions?.config !== 'none' && (
                      <li>
                        <button
                          onClick={() => setActiveView('config')}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-sm ${
                            activeView === 'config'
                              ? 'text-blue-400 bg-slate-800/50 font-bold'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                          }`}
                        >
                          <Settings size={16} />
                          <span>Geral</span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
           {/* Botão de Importar */}
          <button
            onClick={onImportClick}
            className={`w-full flex items-center justify-center gap-3 p-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-900/20`}
          >
            <Upload size={20} />
            {isSidebarOpen && <span className="font-medium">Importar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-14 md:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 md:block"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="md:hidden w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-sm">TF</div>
            
            <div className="md:hidden flex items-center gap-2">
                <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm">TexFlow</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ${isNotificationsOpen ? 'bg-slate-100 dark:bg-slate-800 text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
              title={`${alertCount} Notificações (Atrasos e Datas Pendentes)`}
            >
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                  {alertCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Notificações</h3>
                    <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {alertCount} alertas
                    </span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto overflow-x-hidden py-2">
                    {orders.filter(o => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isLate = o.requestedDate && o.requestedDate < today && o.qtyOpen > 0;
                      const hasPending = o.sectorPredictedDatesPending && Object.values(o.sectorPredictedDatesPending).some(v => v === true);
                      return isLate || hasPending;
                    }).map(order => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isLate = order.requestedDate && order.requestedDate < today && order.qtyOpen > 0;
                      const pendingSectors = Object.entries(order.sectorPredictedDatesPending || {})
                        .filter(([_, v]) => v === true)
                        .map(([id, _]) => SECTORS.find(s => s.id === id)?.name || id);

                      return (
                        <button
                          key={order.id}
                          onClick={() => {
                            onViewDetails(order);
                            setIsNotificationsOpen(false);
                          }}
                          className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 group"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {order.clientName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{order.docNr}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                            {order.reference} • {order.colorDesc}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {isLate && (
                              <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-md">
                                <AlertTriangle size={10} />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Entrega Atrasada</span>
                              </div>
                            )}
                            {pendingSectors.length > 0 && (
                              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">
                                <Calendar size={10} />
                                <span className="text-[10px] font-black uppercase tracking-tighter">
                                  Validar: {pendingSectors.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {alertCount === 0 && (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Bell size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sem notificações pendentes.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            
            <div className="pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-700">
              <button 
                onClick={onLogout}
                className="flex items-center gap-3 group hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                title="Sair (Logout)"
              >
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{user?.name || 'Utilizador'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium group-hover:text-rose-400 dark:group-hover:text-rose-300 transition-colors">{user?.role === 'admin' ? 'Administrador' : 'Leitura'}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:border-rose-200 dark:group-hover:border-rose-900 group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shadow-sm">
                  <UserIcon size={18} />
                </div>
                <div className="text-slate-300 dark:text-slate-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                    <LogOut size={16} />
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 overflow-hidden">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Fixa na base */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-colors ${
              activeView === item.id || (item.id === 'orders' && activeView === 'order-details') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <item.icon size={20} strokeWidth={activeView === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onImportClick}
          className="flex flex-col items-center justify-center gap-1 min-w-[64px] text-emerald-600 dark:text-emerald-500"
        >
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full -mt-8 shadow-md border-2 border-white dark:border-slate-900">
            <Upload size={20} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Importar</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
