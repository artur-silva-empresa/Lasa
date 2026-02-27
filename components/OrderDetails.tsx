
import React from 'react';
import { X, User, ShoppingBag, Palette, Ruler, CheckCircle, Package, MessageSquare, Save, FileText as FileIcon, Trash2, Lock, Flag, Hand, AlertCircle } from 'lucide-react';
import { Order, Sector, SectorState, User as UserType } from '../types';
import { getSectorState } from '../services/dataService';
import { formatDate } from '../utils/formatters';
import { SECTORS, STATUS_COLORS } from '../constants';
import StopReasonSelector from './StopReasonSelector';

interface OrderDetailsProps {
  order: Order;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: Order) => void;
  user: UserType | null;
  stopReasonsHierarchy: any[];
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onClose, onUpdateOrder, user, stopReasonsHierarchy }) => {
  const [editingSector, setEditingSector] = React.useState<Sector | null>(null);
  const [obsText, setObsText] = React.useState('');
  const [stopReason, setStopReason] = React.useState('');

  const canEdit = editingSector ? (user?.permissions?.sectors?.[editingSector.id] === 'write') : false;

  const handleSectorClick = (sector: Sector) => {
    setEditingSector(sector);
    setObsText(order.sectorObservations?.[sector.id] || '');
    setStopReason(order.sectorStopReasons?.[sector.id] || '');
  };

  const handleSaveObservation = () => {
    if (!editingSector || user?.permissions?.sectors?.[editingSector.id] !== 'write') return;
    const updatedObservations = { ...(order.sectorObservations || {}), [editingSector.id]: obsText };
    const updatedStopReasons = { ...(order.sectorStopReasons || {}), [editingSector.id]: stopReason };
    onUpdateOrder({ 
      ...order, 
      sectorObservations: updatedObservations,
      sectorStopReasons: updatedStopReasons
    });
    setEditingSector(null);
  };
  
  const getSectorProducedQty = (sectorId: string): number => {
      switch (sectorId) {
        case 'tecelagem': return order.felpoCruQty;
        case 'felpo_cru': return order.felpoCruQty;
        case 'tinturaria': return order.tinturariaQty;
        case 'confeccao': return order.confRoupoesQty + order.confFelposQty;
        case 'embalagem': return order.embAcabQty;
        case 'expedicao': return order.stockCxQty;
        default: return 0;
      }
  };

  const getSectorDate = (sectorId: string): Date | null => {
    switch (sectorId) {
      case 'tecelagem': return order.dataTec;
      case 'felpo_cru': return order.felpoCruDate;
      case 'tinturaria': return order.tinturariaDate;
      case 'confeccao': return order.confDate;
      case 'embalagem': return order.armExpDate;
      case 'expedicao': return order.armExpDate;
      default: return null;
    }
  };

  const missingQty = Math.max(0, order.qtyRequested - order.stockCxQty);

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 w-full h-full flex flex-col overflow-hidden">
        {/* Header matching LAYOUT.png */}
        <header className="px-8 py-6 flex justify-between items-start shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
                <div className="text-blue-600 dark:text-blue-400">
                    <User size={20} strokeWidth={2.5} />
                </div>
                <h1 className="text-2xl font-black text-[#1e40af] dark:text-blue-400 uppercase tracking-tight flex items-center gap-3">
                    {order.clientName}
                    <span className="text-[#94a3b8] font-bold text-xl">{order.docNr}</span>
                </h1>
            </div>
            <div className="text-[#64748b] dark:text-slate-400 font-bold text-lg flex items-center gap-2 pl-7">
                {order.reference} - {order.colorDesc} <span className="text-[#cbd5e1]">•</span> {order.sizeDesc || order.size}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm shrink-0">
            <X size={28} />
          </button>
        </header>

        {/* 3-Column Content Layout */}
        <div className="flex-1 flex overflow-hidden px-8 pb-6 gap-8">

            {/* Column 1: FLUXO DE PRODUÇÃO (Vertical) */}
            <aside className="w-32 shrink-0 flex flex-col items-center">
                <h3 className="text-[11px] font-black text-[#94a3b8] dark:text-slate-500 uppercase tracking-widest mb-6 w-full text-center">Fluxo de Produção</h3>
                <div className="flex flex-col items-center gap-8 w-full overflow-y-auto pr-2 custom-scrollbar">
                    {SECTORS.map((s) => {
                        const sectorState = getSectorState(order, s.id);
                        const producedQty = getSectorProducedQty(s.id);
                        const SectorIcon = s.icon;
                        const isCompleted = sectorState === SectorState.COMPLETED || producedQty >= order.qtyRequested;

                        return (
                            <div key={s.id} className="flex flex-col items-center gap-2 group">
                                <button
                                    onClick={() => handleSectorClick(s)}
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center relative transition-all active:scale-95 shadow-lg ${isCompleted ? 'bg-[#10b981]' : 'bg-slate-200 dark:bg-slate-800'}`}
                                >
                                    <SectorIcon size={24} className="text-white" />
                                    {isCompleted && (
                                        <div className="absolute -top-1.5 -right-1.5 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-md">
                                            <CheckCircle size={16} className="text-[#10b981]" />
                                        </div>
                                    )}
                                </button>

                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2 py-1 rounded-md shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-400">{order.qtyRequested.toLocaleString('pt-PT')} / </span>
                                    <span className="text-[11px] font-black text-[#10b981]">{producedQty.toLocaleString('pt-PT')}</span>
                                </div>

                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-center">
                                    {s.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* Column 2: Histórico de Observações (Center) */}
            <main className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-center mb-6">
                    <h3 className="text-sm font-black text-[#1e293b] dark:text-slate-200 uppercase tracking-tight">Histórico de Observações</h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                    {SECTORS.map(sector => {
                        const obs = order.sectorObservations?.[sector.id];
                        const reason = order.sectorStopReasons?.[sector.id];
                        const SectorIcon = sector.icon;
                        const sectorDate = getSectorDate(sector.id);
                        const predDate = order.sectorPredictedDates?.[sector.id];
                        const hasWritePerm = user?.permissions?.sectors?.[sector.id] === 'write';

                        return (
                            <div
                                key={sector.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                            <SectorIcon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-[#2563eb] dark:text-blue-400 text-sm uppercase tracking-tight">{sector.name}</h4>
                                            {reason && (
                                                <div className="flex items-center gap-1.5 mt-0.5 text-rose-500 font-bold text-[10px] uppercase">
                                                    <AlertCircle size={12} /> {reason}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col gap-0.5">
                                        {sectorDate && <span className="text-[10px] font-bold text-slate-400 uppercase">Data Sector: {formatDate(sectorDate)}</span>}
                                        {predDate && <span className="text-[10px] font-black text-rose-500 uppercase">Data Prevista: {formatDate(predDate)}</span>}
                                    </div>
                                </div>

                                <div
                                    onClick={() => hasWritePerm && handleSectorClick(sector)}
                                    className={`text-sm py-2 px-1 rounded-lg transition-colors ${hasWritePerm ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                                >
                                    <p className={`whitespace-pre-wrap break-words leading-relaxed ${obs ? 'text-slate-600 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-600 italic'}`}>
                                        {obs || (hasWritePerm ? 'Sem observações (Clique para editar)' : 'Sem observações')}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Edit Observation Overlay/Modal-like area */}
                {editingSector && (
                    <div className="mt-4 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                                <MessageSquare size={16} /> Editar Notas: {editingSector.name}
                            </h4>
                            <button onClick={() => setEditingSector(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                        </div>
                        <div className="flex items-center gap-3 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                             <span className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1 shrink-0">
                                <AlertCircle size={14}/> Motivo:
                             </span>
                             <StopReasonSelector
                                currentReason={stopReason} 
                                onSelect={setStopReason} 
                                hierarchy={stopReasonsHierarchy}
                             />
                        </div>
                        <textarea
                            value={obsText}
                            onChange={(e) => setObsText(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                            placeholder="Escreva as observações aqui..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-3">
                            <button
                                onClick={() => setEditingSector(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveObservation}
                                className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                <Save size={16} /> Guardar Alterações
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Column 3: Info (Right) */}
            <aside className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">

                {/* QTD EM FALTA Card */}
                <section className="bg-[#0f172a] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-center border border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Qtd em Falta</p>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-black tabular-nums tracking-tighter">{missingQty.toLocaleString('pt-PT')}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">UNI</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full mb-3 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                            style={{ width: `${order.qtyRequested > 0 ? Math.min(100, (order.stockCxQty / order.qtyRequested) * 100) : 0}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 text-right uppercase tracking-tight">TOTAL PEDIDO: {order.qtyRequested.toLocaleString('pt-PT')}</p>
                </section>

                {/* Dates Section */}
                <div className="space-y-2">
                    <DateRow label="Emissão" date={order.issueDate} />
                    <DateRow label="Armazém Exp." date={order.armExpDate} />
                    <DateRow label="Data Entrega" date={order.requestedDate} highlight />
                </div>

                {/* Info Cards Section */}
                <div className="space-y-3 mt-2">
                    <InfoCard compact icon={<Palette size={16} />} label="Artigo" value={order.articleCode} />
                    <InfoCard compact icon={<FileIcon size={16} />} label="PO" value={order.po} />
                    <InfoCard compact icon={<ShoppingBag size={16} />} label="Referência" value={order.reference} subValue={order.colorDesc} />
                    <InfoCard compact icon={<Ruler size={16} />} label="Medida / Tamanho" value={order.sizeDesc || order.size} />
                </div>

                {/* Additional Badges if needed */}
                <div className="flex flex-wrap gap-2 mt-2">
                    {order.priority && (
                        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${getPriorityClasses(order.priority)}`}>
                            <Flag size={12} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-wide">Prioridade {order.priority === 1 ? 'Alta' : order.priority === 2 ? 'Média' : 'Baixa'}</span>
                        </div>
                    )}
                    {order.isManual && (
                        <div className="px-3 py-1.5 rounded-xl border bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-2">
                            <Hand size={12} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-wide">Conf. Manual</span>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    </div>
  );
};

const InfoCard = ({ icon, label, value, subValue, compact }: any) => (
  <div className={`p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-blue-100 dark:hover:border-blue-900 ${compact ? 'py-3 px-4' : ''}`}>
    <div className="flex items-center gap-3 mb-1">
        <div className="text-blue-500 dark:text-blue-400">{icon}</div>
        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-sm font-black text-slate-800 dark:text-slate-200 break-words leading-tight ml-7 uppercase tracking-tight">{value}</p>
    {subValue && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-7 font-bold uppercase">{subValue}</p>}
  </div>
);

const DateRow = ({ label, date, highlight }: any) => (
  <div className={`flex justify-between items-center px-5 py-3 rounded-2xl border transition-all ${highlight ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/50' : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800 shadow-sm'}`}>
    <span className={`text-[10px] font-black uppercase tracking-tight ${highlight ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
    <span className={`text-sm font-black tabular-nums ${highlight ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{formatDate(date)}</span>
  </div>
);

const getPriorityClasses = (p: number) => {
    switch(p) {
        case 1: return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
        case 2: return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
        case 3: return 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
        default: return '';
    }
};

export default OrderDetails;
