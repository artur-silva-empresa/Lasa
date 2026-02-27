
import React from 'react';
import {
  GripVertical, Check, X, FileSpreadsheet, RotateCcw, ChevronDown,
  ChevronUp, Eye, EyeOff, Loader2, CheckSquare, Square, Download
} from 'lucide-react';
import {
  ALL_EXPORT_COLUMNS, DEFAULT_SELECTED_COLUMNS, ExportColumnDef,
  saveExportColumnsConfig, loadExportColumnsConfig, exportCustomColumns
} from '../services/dataService';
import { Order } from '../types';

interface ExportableColumnsProps {
  orders: Order[];
}

const ExportableColumns: React.FC<ExportableColumnsProps> = ({ orders }) => {
  // selectedKeys mantém a ordem escolhida pelo utilizador
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>(DEFAULT_SELECTED_COLUMNS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportSuccess, setExportSuccess] = React.useState(false);

  // Grupos expandidos/colapsados no painel esquerdo
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Todos os grupos disponíveis
  const groups = React.useMemo(() => {
    const map: Record<string, ExportColumnDef[]> = {};
    ALL_EXPORT_COLUMNS.forEach(col => {
      if (!map[col.group]) map[col.group] = [];
      map[col.group].push(col);
    });
    return map;
  }, []);

  // Colunas selecionadas com definição completa, na ordem certa
  const selectedCols = React.useMemo(() =>
    selectedKeys
      .map(k => ALL_EXPORT_COLUMNS.find(c => c.key === k))
      .filter(Boolean) as ExportColumnDef[]
  , [selectedKeys]);

  // Carregar configuração guardada
  React.useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const saved = await loadExportColumnsConfig();
        if (saved && saved.length > 0) setSelectedKeys(saved);
      } catch (e) {
        console.error('Erro ao carregar config de colunas:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const toggleColumn = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleGroup = (group: string) => {
    const keys = groups[group].map(c => c.key);
    const allSelected = keys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys(prev => prev.filter(k => !keys.includes(k)));
    } else {
      const toAdd = keys.filter(k => !selectedKeys.includes(k));
      setSelectedKeys(prev => [...prev, ...toAdd]);
    }
  };

  const isGroupFullySelected = (group: string) =>
    groups[group].every(c => selectedKeys.includes(c.key));
  const isGroupPartiallySelected = (group: string) =>
    groups[group].some(c => selectedKeys.includes(c.key)) && !isGroupFullySelected(group);

  const toggleGroupCollapsed = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(ALL_EXPORT_COLUMNS.map(c => c.key));
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
  };

  const handleReset = () => {
    setSelectedKeys(DEFAULT_SELECTED_COLUMNS);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveExportColumnsConfig(selectedKeys);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Erro ao guardar config:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (orders.length === 0 || selectedKeys.length === 0) return;
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await new Promise(r => setTimeout(r, 50));
      exportCustomColumns(orders, selectedKeys);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (e) {
      console.error('Erro ao exportar:', e);
      alert('Erro ao exportar ficheiro Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Remove coluna da lista (botão X na lista direita)
  const removeColumn = (key: string) => {
    setSelectedKeys(prev => prev.filter(k => k !== key));
  };

  // Move coluna para cima/baixo
  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const next = [...selectedKeys];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedKeys(next);
  };

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...selectedKeys];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setSelectedKeys(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm font-medium">A carregar configuração...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botões de ação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Selecione e ordene as colunas a incluir na exportação Excel personalizada.
            <span className="ml-1 font-bold text-blue-600 dark:text-blue-400">{selectedKeys.length}</span> de <span className="font-bold">{ALL_EXPORT_COLUMNS.length}</span> colunas selecionadas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Repor seleção padrão"
          >
            <RotateCcw size={13} /> Repor
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white rounded-lg transition-all active:scale-95 ${
              saveSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
            }`}
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : saveSuccess ? <Check size={13} /> : <Check size={13} />}
            {saveSuccess ? 'Guardado!' : 'Guardar Config.'}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedKeys.length === 0 || orders.length === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white rounded-lg transition-all active:scale-95 shadow-sm ${
              exportSuccess ? 'bg-emerald-600' : 'bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isExporting
              ? <Loader2 size={13} className="animate-spin" />
              : exportSuccess ? <Check size={13} /> : <Download size={13} />
            }
            {exportSuccess ? 'Exportado!' : 'Exportar Tabela'}
          </button>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
          Sem dados na base de dados. Importe encomendas para poder exportar.
        </div>
      )}

      {/* Layout de 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* === PAINEL ESQUERDO — Todas as colunas disponíveis === */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Colunas Disponíveis</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Todas
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button
                onClick={handleClearAll}
                className="text-[10px] font-bold text-rose-500 hover:underline"
              >
                Nenhuma
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800/50 overflow-y-auto max-h-[520px]">
            {Object.entries(groups).map(([groupName, cols]) => {
              const collapsed = collapsedGroups.has(groupName);
              const allSel = isGroupFullySelected(groupName);
              const partSel = isGroupPartiallySelected(groupName);

              return (
                <div key={groupName}>
                  {/* Cabeçalho do grupo */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="shrink-0"
                      title={allSel ? 'Desselecionar grupo' : 'Selecionar grupo'}
                    >
                      {allSel
                        ? <CheckSquare size={15} className="text-blue-600 dark:text-blue-400" />
                        : partSel
                          ? <CheckSquare size={15} className="text-blue-400/60 dark:text-blue-600/60" />
                          : <Square size={15} className="text-slate-300 dark:text-slate-600" />
                      }
                    </button>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1">{groupName}</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mr-1">
                      {(cols as ExportColumnDef[]).filter(c => selectedKeys.includes(c.key)).length}/{(cols as ExportColumnDef[]).length}
                    </span>
                    <button
                      onClick={() => toggleGroupCollapsed(groupName)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  </div>

                  {/* Colunas do grupo */}
                  {!collapsed && (
                    <div className="px-2 py-1.5 space-y-0.5">
                      {(cols as ExportColumnDef[]).map(col => {
                        const isSelected = selectedKeys.includes(col.key);
                        return (
                          <button
                            key={col.key}
                            onClick={() => toggleColumn(col.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-medium'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </span>
                            <span className="truncate">{col.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* === PAINEL DIREITO — Colunas selecionadas (ordem configurável) === */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ordem de Exportação</h3>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {selectedKeys.length} colunas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px]">
            {selectedCols.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-300 dark:text-slate-600 gap-2">
                <FileSpreadsheet size={32} />
                <p className="text-xs font-medium text-center px-4">Selecione colunas no painel à esquerda</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {selectedCols.map((col, index) => (
                  <div
                    key={col.key}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragIndex === index
                        ? 'opacity-40 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                        : dragOverIndex === index
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 scale-[1.01]'
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Número de posição */}
                    <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 w-4 text-center shrink-0">
                      {index + 1}
                    </span>

                    {/* Handle de drag */}
                    <GripVertical size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />

                    {/* Nome e grupo */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{col.label}</p>
                      <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 truncate">{col.group}</p>
                    </div>

                    {/* Botões de reordenação */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => moveColumn(index, 'up')}
                        disabled={index === 0}
                        className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover para cima"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveColumn(index, 'down')}
                        disabled={index === selectedCols.length - 1}
                        className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover para baixo"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    {/* Remover */}
                    <button
                      onClick={() => removeColumn(col.key)}
                      className="p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all shrink-0"
                      title="Remover coluna"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pré-visualização (footer) */}
          {selectedCols.length > 0 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pré-visualização da 1ª linha</p>
              <div className="flex gap-1 flex-wrap">
                {selectedCols.slice(0, 8).map(col => (
                  <span
                    key={col.key}
                    className="text-[9px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium"
                  >
                    {col.label}
                  </span>
                ))}
                {selectedCols.length > 8 && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium self-center">
                    +{selectedCols.length - 8} mais
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
          <strong>Nota:</strong> A configuração é guardada localmente. A exportação gera um ficheiro Excel com apenas as colunas selecionadas, na ordem definida. Arraste as linhas do painel direito para reordenar ou use as setas ▲▼.
        </p>
      </div>
    </div>
  );
};

export default ExportableColumns;
