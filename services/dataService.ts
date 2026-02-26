
import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { Order, OrderState, SectorState, DashboardKPIs, User, UserRole, PermissionLevel } from '../types';
import { parseExcelDate, formatDate } from '../utils/formatters';
import { SECTORS } from '../constants';

// --- PERSISTÊNCIA (IndexedDB) ---
const DB_NAME = 'TexFlowData';
const DB_VERSION = 5;
const STORE_HANDLES = 'handles';
const STORE_ORDERS = 'orders';
const STORE_HEADERS = 'headers';
const STORE_STOP_REASONS = 'stop_reasons';
const STORE_USERS = 'users';
const STORE_EXPORT_COLUMNS = 'export_columns';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS);
      }
      if (!db.objectStoreNames.contains(STORE_HEADERS)) {
        db.createObjectStore(STORE_HEADERS);
      }
      if (!db.objectStoreNames.contains(STORE_STOP_REASONS)) {
        db.createObjectStore(STORE_STOP_REASONS);
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_EXPORT_COLUMNS)) {
        db.createObjectStore(STORE_EXPORT_COLUMNS);
      }
    };
    
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

// --- DATA PERSISTENCE HELPERS ---

export const hashPassword = async (password: string): Promise<string> => {
    // Fallback for non-secure contexts where crypto.subtle is undefined
    if (!window.crypto || !window.crypto.subtle) {
        console.warn("Crypto Subtle não disponível. A usar fallback inseguro (apenas para desenvolvimento/contextos HTTP).");
        // Fallback extremamente simples (NÃO SEGURO para produção, mas evita crash)
        return Array.from(password).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), "");
    }
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

export const saveUserToDB = async (user: User) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_USERS, 'readwrite');
        tx.objectStore(STORE_USERS).put(user);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const deleteUserFromDB = async (userId: string) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_USERS, 'readwrite');
        tx.objectStore(STORE_USERS).delete(userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const loadUsersFromDB = async (): Promise<User[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_USERS, 'readonly');
        const req = tx.objectStore(STORE_USERS).getAll();
        tx.oncomplete = () => resolve(req.result || []);
        tx.onerror = () => reject(tx.error);
    });
};

export const initializeDefaultUsers = async () => {
    const users = await loadUsersFromDB();
    if (users.length === 0) {
        const adminPerms: any = {
            dashboard: 'write',
            orders: 'write',
            timeline: 'write',
            config: 'write',
            stopReasons: 'write',
            sectors: {}
        };
        SECTORS.forEach(s => adminPerms.sectors[s.id] = 'write');

        const viewerPerms: any = {
            dashboard: 'none',
            orders: 'read',
            timeline: 'read',
            config: 'none',
            stopReasons: 'none',
            sectors: {}
        };
        SECTORS.forEach(s => viewerPerms.sectors[s.id] = 'read');

        const planUser: User = {
            id: '1',
            username: 'Plan',
            name: 'Planeamento',
            passwordHash: await hashPassword('Lasa'),
            role: 'admin',
            permissions: adminPerms
        };

        const lasaUser: User = {
            id: '2',
            username: 'Lasa',
            name: 'Utilizador Lasa',
            passwordHash: await hashPassword(''),
            role: 'viewer',
            permissions: viewerPerms
        };

        await saveUserToDB(planUser);
        await saveUserToDB(lasaUser);
        return [planUser, lasaUser];
    }
    return users;
};

export const saveStopReasonsToDB = async (hierarchy: any[]) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_STOP_REASONS, 'readwrite');
        tx.objectStore(STORE_STOP_REASONS).put(hierarchy, 'main_hierarchy');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const loadStopReasonsFromDB = async (): Promise<any[] | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_STOP_REASONS, 'readonly');
        const req = tx.objectStore(STORE_STOP_REASONS).get('main_hierarchy');
        tx.oncomplete = () => resolve(req.result || null);
        tx.onerror = () => resolve(null);
    });
};

export const saveOrdersToDB = async (orders: Order[], headers: Record<string, string>) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_ORDERS, STORE_HEADERS], 'readwrite');
        tx.objectStore(STORE_ORDERS).put(orders, 'main_list');
        tx.objectStore(STORE_HEADERS).put(headers, 'main_headers');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const loadOrdersFromDB = async (): Promise<{orders: Order[], headers: Record<string, string>} | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_ORDERS, STORE_HEADERS], 'readonly');
        const reqOrders = tx.objectStore(STORE_ORDERS).get('main_list');
        const reqHeaders = tx.objectStore(STORE_HEADERS).get('main_headers');
        
        tx.oncomplete = () => {
            if (reqOrders.result) {
                const hydratedOrders = (reqOrders.result as any[]).map(o => ({
                    ...o,
                    issueDate: o.issueDate ? new Date(o.issueDate) : null,
                    requestedDate: o.requestedDate ? new Date(o.requestedDate) : null,
                    dataTec: o.dataTec ? new Date(o.dataTec) : null,
                    felpoCruDate: o.felpoCruDate ? new Date(o.felpoCruDate) : null,
                    tinturariaDate: o.tinturariaDate ? new Date(o.tinturariaDate) : null,
                    confDate: o.confDate ? new Date(o.confDate) : null,
                    armExpDate: o.armExpDate ? new Date(o.armExpDate) : null,
                    dataEnt: o.dataEnt ? new Date(o.dataEnt) : null,
                }));
                resolve({ orders: hydratedOrders, headers: reqHeaders.result || {} });
            } else {
                resolve(null);
            }
        };
        tx.onerror = () => resolve(null);
    });
};

export const clearOrdersFromDB = async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_ORDERS, STORE_HEADERS], 'readwrite');
        tx.objectStore(STORE_ORDERS).clear();
        tx.objectStore(STORE_HEADERS).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// --- FILE HANDLES ---

export const saveDirectoryHandle = async (key: 'import' | 'export', handle: any) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    const store = tx.objectStore(STORE_HANDLES);
    const req = store.put(handle, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

export const getDirectoryHandle = async (key: 'import' | 'export'): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readonly');
    const store = tx.objectStore(STORE_HANDLES);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const verifyPermission = async (handle: any, readWrite: boolean = false) => {
  if (!handle) return false;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
  } catch (e) {
    console.error("Erro ao verificar permissões:", e);
    return false;
  }
  return false;
};

// --- CONFIGURAÇÃO SQL.JS ---
// O ficheiro sql-wasm.wasm é copiado de node_modules para public/ pelo script prebuild.
// Usamos import.meta.env.BASE_URL para que o path funcione automaticamente
// com qualquer valor de base configurado no vite.config.ts (ex: '/Lasa/' ou '/').
const getSql = async () => {
  try {
    const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/Lasa/';
    const wasmPath = `${base}sql-wasm.wasm`;
    return await initSqlJs({
      locateFile: () => wasmPath
    });
  } catch (error) {
    console.error("Falha ao inicializar SQL.js:", error);
    throw new Error("Não foi possível carregar o motor de base de dados.");
  }
};

const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const str = String(val).trim();
  if (!str) return 0;

  // Formato: 1.234,56 (PT/EU)
  if (str.includes(',') && str.includes('.')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  
  // Formato: 1,234 (PT/EU decimal simples) ou 1,234.56 (US - handled above if both exist, but here only comma)
  // Assumindo que num ficheiro PT, virgula é decimal.
  if (str.includes(',')) {
    const normalized = str.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }

  // Formato: 1.234 (PT milhar) ou 1.234 (US decimal)
  // No contexto industrial PT, 1.234 costuma ser 1234.
  // Vamos remover o ponto se houver, assumindo que é milhar, exceto se parecer muito pequeno?
  // Risco: 1.5Kg vs 1500 Unidades.
  // Heurística: Se tiver 3 digitos após ponto, é milhar.
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
       // Provavel milhar: 1.500 -> 1500
       const normalized = str.replace(/\./g, '');
       const num = parseFloat(normalized);
       return isNaN(num) ? 0 : num;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const getOrderState = (order: Order): OrderState => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const isCompleted = order.qtyOpen === 0 || (order.stockCxQty >= order.qtyRequested && order.qtyRequested > 0);
  if (isCompleted) return OrderState.COMPLETED;
  
  if (order.dataTec && order.dataTec < now && order.felpoCruQty < order.qtyRequested) return OrderState.LATE;
  if (order.felpoCruDate && order.felpoCruDate < now && order.felpoCruQty < order.qtyRequested) return OrderState.LATE;
  
  const confTotal = order.confRoupoesQty + order.confFelposQty;
  if (order.tinturariaDate && order.tinturariaDate < now && confTotal < order.qtyRequested) return OrderState.LATE;
  if (order.confDate && order.confDate < now && order.embAcabQty < order.qtyRequested) return OrderState.LATE;

  if (order.requestedDate && order.requestedDate < now && order.qtyOpen > 0) return OrderState.LATE;
  
  const hasStarted = order.felpoCruQty > 0 || order.tinturariaQty > 0 || confTotal > 0 || order.embAcabQty > 0;
  if (hasStarted) return OrderState.IN_PRODUCTION;
  
  return OrderState.OPEN;
};

export const getSectorState = (order: Order, sectorId: string): SectorState => {
  let qty = 0;
  switch (sectorId) {
    case 'tecelagem': qty = order.felpoCruQty; break;
    case 'felpo_cru': qty = order.felpoCruQty; break;
    case 'tinturaria': qty = order.tinturariaQty; break;
    case 'confeccao': qty = order.confRoupoesQty + order.confFelposQty; break;
    case 'embalagem': qty = order.embAcabQty; break;
    case 'expedicao': qty = order.stockCxQty; break;
  }

  if (order.qtyRequested > 0 && qty >= order.qtyRequested) return SectorState.COMPLETED;
  if (qty > 0) return SectorState.IN_PROGRESS;
  return SectorState.NOT_STARTED;
};

// Helper para obter o início e fim da semana
export const getWeekRange = (date: Date) => {
    const current = new Date(date);
    // Ajustar para o início do dia para evitar problemas de hora
    current.setHours(0, 0, 0, 0);
    
    // Obter o dia da semana (0 = Domingo, 1 = Segunda, ...)
    const day = current.getDay();
    
    // Calcular a diferença para chegar a Segunda-feira (considerando Domingo como dia 0, queremos que a semana comece na Segunda anterior)
    // Se for Domingo (0), diff é -6. Se for Segunda (1), diff é 0.
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    
    const startOfWeek = new Date(current.setDate(diff));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
};

export const calculateKPIs = (orders: Order[]): DashboardKPIs => {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(now);

  // 1. Encomendas Ativas (Contagem por Documento Único)
  // Considera ativas as que não estão totalmente concluídas/faturadas (qtyOpen > 0)
  const activeOrders = orders.filter(o => o.qtyOpen > 0);
  const uniqueActiveDocs = new Set(activeOrders.map(o => o.docNr));

  // 2. Atrasadas (Qualquer sector)
  const late = orders.filter(o => getOrderState(o) === OrderState.LATE);

  // 3. Entregas da Semana (Baseado na Data de Pedido/Expedição)
  // Considera orders com data pedida dentro da semana corrente
  const ordersThisWeek = orders.filter(o => {
    // Usa requestedDate como data principal de entrega, fallback para armExpDate
    const dateToCheck = o.requestedDate || o.armExpDate; 
    return dateToCheck && dateToCheck >= weekStart && dateToCheck <= weekEnd;
  });
  
  const deliveriesThisWeek = ordersThisWeek.length;

  // 4. Taxa de Conclusão Semanal
  // (Encomendas desta semana que estão Concluídas) / (Total de encomendas desta semana)
  const completedThisWeek = ordersThisWeek.filter(o => {
      const state = getOrderState(o);
      // Se estado for COMPLETED ou se já estiverem em Expedição (último setor antes de faturar)
      return state === OrderState.COMPLETED || getSectorState(o, 'expedicao') === SectorState.COMPLETED || getSectorState(o, 'expedicao') === SectorState.IN_PROGRESS;
  }).length;

  const fulfillmentRateWeek = deliveriesThisWeek > 0 ? (completedThisWeek / deliveriesThisWeek) * 100 : 0;

  return {
    totalActiveDocs: uniqueActiveDocs.size,
    totalLate: late.length,
    deliveriesThisWeek: deliveriesThisWeek,
    fulfillmentRateWeek: fulfillmentRateWeek,
    totalInProduction: activeOrders.length,
    billedVsOpen: { 
      billed: orders.reduce((acc, o) => acc + o.qtyBilled, 0), 
      open: orders.reduce((acc, o) => acc + o.qtyOpen, 0) 
    }
  };
};

// --- IMPORTAÇÃO DE EXCEL (.xlsx) ---
export const parseExcelFile = async (file: File): Promise<{ orders: Order[], headers: Record<string, string> }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        // Priorizar folha "Dados_BD" se existir, caso contrário usar a primeira
        const sheetName = workbook.SheetNames.includes('Dados_BD') ? 'Dados_BD' : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
        if (jsonData.length === 0) return resolve({ orders: [], headers: {} });

        // Apanhar headers da primeira linha real se existirem, ou assumir layout fixo
        const extractedHeaders = jsonData.shift() as Record<string, string> || {};
        const mappedOrders: Order[] = [];
        
        for (let i = 0; i < jsonData.length; i++) {
            const row: any = jsonData[i];
            
            // Validação mínima para ignorar linhas vazias ou cabeçalhos repetidos
            if (!row['B'] || String(row['B']).toLowerCase().includes('doc')) continue;
            
            const docNr = String(row['B']).trim();
            const itemNr = parseNumber(row['F']);

            const order: Order = {
                _raw: row, 
                id: row['A'] || `${docNr}-${itemNr}`,
                docNr: docNr,
                clientCode: String(row['AE'] || row['C'] || '').trim(),
                clientName: String(row['C'] || '').trim(),
                comercial: String(row['AD'] || row['L'] || '').trim(),
                issueDate: parseExcelDate(row['D']),
                requestedDate: parseExcelDate(row['E']),
                itemNr: itemNr,
                po: String(row['G'] || '').trim(),
                articleCode: String(row['H'] || '').trim(),
                reference: String(row['I'] || '').trim(),
                colorCode: String(row['J'] || '').trim(),
                colorDesc: String(row['K'] || '').trim(),
                size: String(row['L'] || '').trim(),
                family: String(row['M'] || '').trim(),
                sizeDesc: String(row['N'] || '').trim(),
                ean: String(row['O'] || '').trim(),
                qtyRequested: parseNumber(row['P']),
                dataTec: parseExcelDate(row['Q']),
                felpoCruQty: parseNumber(row['R']),
                felpoCruDate: parseExcelDate(row['S']),
                tinturariaQty: parseNumber(row['T']),
                tinturariaDate: parseExcelDate(row['U']),
                confRoupoesQty: parseNumber(row['V']),
                confFelposQty: parseNumber(row['W']),
                confDate: parseExcelDate(row['X']),
                embAcabQty: parseNumber(row['Y']),
                armExpDate: parseExcelDate(row['Z']),
                stockCxQty: parseNumber(row['AA']),
                qtyBilled: parseNumber(row['AB']),
                qtyOpen: parseNumber(row['AC']),
                dataEnt: parseExcelDate(row['E']),

                // Campos Estendidos (TexFlow Round-trip)
                priority: row['AF'] ? parseInt(row['AF']) : 0,
                isManual: row['AG'] === 1 || row['AG'] === '1' || row['AG'] === true,
                sectorObservations: row['AH'] ? JSON.parse(row['AH']) : {},
                sectorPredictedDates: row['AI'] ? JSON.parse(row['AI']) : {},
                sectorStopReasons: row['AJ'] ? JSON.parse(row['AJ']) : {},
                dataEspecial: parseExcelDate(row['AK']),
                dataPrinter: parseExcelDate(row['AL']),
                dataDebuxo: parseExcelDate(row['AM']),
                dataAmostras: parseExcelDate(row['AN']),
                dataBordados: parseExcelDate(row['AO']),
                isArchived: row['AP'] === 1 || row['AP'] === '1' || row['AP'] === true,
                archivedAt: parseExcelDate(row['AQ']),
                archivedBy: row['AR'] || null
            };

            // Hidratação de datas nos objetos JSON
            if (order.sectorPredictedDates) {
                Object.keys(order.sectorPredictedDates).forEach(k => {
                    if (order.sectorPredictedDates![k]) order.sectorPredictedDates![k] = new Date(order.sectorPredictedDates![k] as any);
                });
            }

            mappedOrders.push(order);
        }
        resolve({ orders: mappedOrders, headers: extractedHeaders });
      } catch (err) { 
          console.error("Erro no processamento Excel:", err);
          reject(new Error("Erro ao processar ficheiro Excel.")); 
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler ficheiro."));
    reader.readAsArrayBuffer(file);
  });
};

// --- IMPORTAÇÃO DE SQLITE ---
export const parseSQLiteFile = async (file: File): Promise<{ orders: Order[], headers: Record<string, string> }> => {
  const SQL = await getSql();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const Uints = new Uint8Array(e.target?.result as ArrayBuffer);
        const db = new SQL.Database(Uints);
        
        let headers: Record<string, string> = {};
        try {
            const headerStmt = db.prepare("SELECT key, value FROM headers");
            while(headerStmt.step()) {
                const row = headerStmt.getAsObject();
                headers[row.key as string] = row.value as string;
            }
            headerStmt.free();
        } catch (e) { console.warn("Tabela headers não encontrada."); }

        const result = db.exec("SELECT * FROM orders");
        if (result.length === 0) {
            resolve({ orders: [], headers });
            return;
        }

        const columns = result[0].columns;
        const values = result[0].values;
        
        const orders: Order[] = values.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            const dateFields = [
                'issueDate', 'requestedDate', 'dataTec', 'felpoCruDate', 'tinturariaDate',
                'confDate', 'armExpDate', 'dataEnt', 'dataEspecial', 'dataPrinter',
                'dataDebuxo', 'dataAmostras', 'dataBordados'
            ];
            dateFields.forEach(field => { if (obj[field]) obj[field] = new Date(obj[field]); });
            if (obj.sectorObservations) {
                try { obj.sectorObservations = JSON.parse(obj.sectorObservations); } catch { obj.sectorObservations = {}; }
            }
            if (obj.sectorPredictedDates) {
                try { 
                    const parsed = JSON.parse(obj.sectorPredictedDates);
                    // Convert string dates back to Date objects
                    Object.keys(parsed).forEach(k => {
                        if (parsed[k]) parsed[k] = new Date(parsed[k]);
                    });
                    obj.sectorPredictedDates = parsed;
                } catch { obj.sectorPredictedDates = {}; }
            }
            if (obj.sectorStopReasons) {
                try { obj.sectorStopReasons = JSON.parse(obj.sectorStopReasons); } catch { obj.sectorStopReasons = {}; }
            }
            if (!obj.priority) obj.priority = 0;
            if (!obj.comercial) obj.comercial = '';
            // Garantir que isManual seja boolean
            obj.isManual = obj.isManual === 1 || obj.isManual === true || obj.isManual === '1';
            // Garantir que isArchived seja boolean
            obj.isArchived = obj.isArchived === 1 || obj.isArchived === true || obj.isArchived === '1';
            if (obj.archivedAt) obj.archivedAt = new Date(obj.archivedAt);
            
            return obj as Order;
        });
        
        db.close();
        resolve({ orders, headers });
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
};

// --- EXPORTAÇÃO PARA SQLITE ---
export const exportOrdersToSQLite = async (orders: Order[], headers: Record<string, string>, directoryHandle?: any, customFileName?: string) => {
  const SQL = await getSql();
  const db = new SQL.Database();

  db.run("CREATE TABLE headers (key TEXT, value TEXT)");
  Object.entries(headers).forEach(([k, v]) => db.run("INSERT INTO headers VALUES (?, ?)", [k, v]));

  const schema = `
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, docNr TEXT, clientCode TEXT, clientName TEXT, comercial TEXT,
      issueDate INTEGER, requestedDate INTEGER, itemNr INTEGER, po TEXT,
      articleCode TEXT, reference TEXT, colorCode TEXT, colorDesc TEXT,
      size TEXT, family TEXT, sizeDesc TEXT, ean TEXT, qtyRequested REAL,
      dataTec INTEGER, felpoCruQty REAL, felpoCruDate INTEGER,
      tinturariaQty REAL, tinturariaDate INTEGER,
      confRoupoesQty REAL, confFelposQty REAL, confDate INTEGER,
      embAcabQty REAL, armExpDate INTEGER, stockCxQty REAL,
      dataEnt INTEGER, qtyBilled REAL, qtyOpen REAL,
      sectorObservations TEXT, sectorPredictedDates TEXT, priority INTEGER, isManual INTEGER, sectorStopReasons TEXT,
      dataEspecial INTEGER, dataPrinter INTEGER, dataDebuxo INTEGER, dataAmostras INTEGER, dataBordados INTEGER,
      isArchived INTEGER, archivedAt INTEGER, archivedBy TEXT
    );
  `;
  db.run(schema);

  db.run("BEGIN TRANSACTION");
  // 45 colunas no total
  const stmt = db.prepare(`
    INSERT INTO orders VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  orders.forEach(o => {
      stmt.run([
        o.id, o.docNr, o.clientCode, o.clientName, o.comercial,
        o.issueDate ? o.issueDate.getTime() : null,
        o.requestedDate ? o.requestedDate.getTime() : null,
        o.itemNr, o.po, o.articleCode, o.reference, o.colorCode, o.colorDesc,
        o.size, o.family, o.sizeDesc, o.ean, o.qtyRequested,
        o.dataTec ? o.dataTec.getTime() : null,
        o.felpoCruQty, o.felpoCruDate ? o.felpoCruDate.getTime() : null,
        o.tinturariaQty, o.tinturariaDate ? o.tinturariaDate.getTime() : null,
        o.confRoupoesQty, o.confFelposQty, o.confDate ? o.confDate.getTime() : null,
        o.embAcabQty, o.armExpDate ? o.armExpDate.getTime() : null,
        o.stockCxQty, o.dataEnt ? o.dataEnt.getTime() : null,
        o.qtyBilled, o.qtyOpen, JSON.stringify(o.sectorObservations || {}),
        JSON.stringify(o.sectorPredictedDates || {}),
        o.priority || 0,
        o.isManual ? 1 : 0,
        JSON.stringify(o.sectorStopReasons || {}),
        o.dataEspecial ? o.dataEspecial.getTime() : null,
        o.dataPrinter ? o.dataPrinter.getTime() : null,
        o.dataDebuxo ? o.dataDebuxo.getTime() : null,
        o.dataAmostras ? o.dataAmostras.getTime() : null,
        o.dataBordados ? o.dataBordados.getTime() : null,
        o.isArchived ? 1 : 0,
        o.archivedAt ? o.archivedAt.getTime() : null,
        o.archivedBy || null
      ]);
  });
  
  stmt.free();
  db.run("COMMIT");

  const data = db.export();

  // Construct Default Filename with DD-MM-YYYY
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  const fileName = customFileName || `TexFlow_DB_${dateStr}.sqlite`;

  if (directoryHandle) {
    try {
      const hasPermission = await verifyPermission(directoryHandle, true);
      if (hasPermission) {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        return; 
      }
    } catch (e) {
      console.error("Erro ao gravar na pasta configurada, usando fallback.", e);
    }
  }

  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- EXPORTAÇÃO PARA EXCEL ---
export const exportOrdersToExcel = (orders: Order[], headers: Record<string, string> = {}, customFileName?: string) => {
    // Definimos a estrutura exata de colunas para garantir compatibilidade com a importação
    // B-AC são as colunas fixas do ERP. AD em diante são extras TexFlow.
    const excelRows = orders.map(o => {
        const row: Record<string, any> = {};

        // Posições baseadas no parseExcelFile (header: 'A')
        row['A'] = o.id;
        row['B'] = o.docNr;
        row['C'] = o.clientName;
        row['D'] = o.issueDate ? formatDate(o.issueDate) : null;
        row['E'] = o.requestedDate ? formatDate(o.requestedDate) : null;
        row['F'] = o.itemNr;
        row['G'] = o.po;
        row['H'] = o.articleCode;
        row['I'] = o.reference;
        row['J'] = o.colorCode;
        row['K'] = o.colorDesc;
        row['L'] = o.size;
        row['M'] = o.family;
        row['N'] = o.sizeDesc;
        row['O'] = o.ean;
        row['P'] = o.qtyRequested;
        row['Q'] = o.dataTec ? formatDate(o.dataTec) : null;
        row['R'] = o.felpoCruQty;
        row['S'] = o.felpoCruDate ? formatDate(o.felpoCruDate) : null;
        row['T'] = o.tinturariaQty;
        row['U'] = o.tinturariaDate ? formatDate(o.tinturariaDate) : null;
        row['V'] = o.confRoupoesQty;
        row['W'] = o.confFelposQty;
        row['X'] = o.confDate ? formatDate(o.confDate) : null;
        row['Y'] = o.embAcabQty;
        row['Z'] = o.armExpDate ? formatDate(o.armExpDate) : null;
        row['AA'] = o.stockCxQty;
        row['AB'] = o.qtyBilled;
        row['AC'] = o.qtyOpen;

        // Extras (AD em diante)
        row['AD'] = o.comercial;
        row['AE'] = o.clientCode;
        row['AF'] = o.priority;
        row['AG'] = o.isManual ? 1 : 0;
        row['AH'] = JSON.stringify(o.sectorObservations || {});
        row['AI'] = JSON.stringify(o.sectorPredictedDates || {});
        row['AJ'] = JSON.stringify(o.sectorStopReasons || {});
        row['AK'] = o.dataEspecial ? formatDate(o.dataEspecial) : null;
        row['AL'] = o.dataPrinter ? formatDate(o.dataPrinter) : null;
        row['AM'] = o.dataDebuxo ? formatDate(o.dataDebuxo) : null;
        row['AN'] = o.dataAmostras ? formatDate(o.dataAmostras) : null;
        row['AO'] = o.dataBordados ? formatDate(o.dataBordados) : null;
        row['AP'] = o.isArchived ? 1 : 0;
        row['AQ'] = o.archivedAt ? formatDate(o.archivedAt) : null;
        row['AR'] = o.archivedBy;

        return row;
    });

    // Cabeçalhos amigáveis (Row 1)
    const headerRow = {
        'A': 'ID Interno', 'B': 'Nr. Documento', 'C': 'Cliente', 'D': 'Data Emissão', 'E': 'Data Entrega',
        'F': 'Item', 'G': 'PO', 'H': 'Artigo', 'I': 'Referência', 'J': 'Cód. Cor', 'K': 'Cor',
        'L': 'Tamanho', 'M': 'Família', 'N': 'Desc. Tamanho', 'O': 'EAN', 'P': 'Qtd. Pedida',
        'Q': 'Data Tecelagem', 'R': 'Qtd. Felpo Cru', 'S': 'Data Felpo Cru', 'T': 'Qtd. Tinturaria',
        'U': 'Data Tinturaria', 'V': 'Qtd. Conf. Roupões', 'W': 'Qtd. Conf. Felpos', 'X': 'Data Confecção',
        'Y': 'Qtd. Embalagem', 'Z': 'Data Prev. Armazém', 'AA': 'Qtd. Stock Caixa', 'AB': 'Qtd. Faturada',
        'AC': 'Qtd. Em Aberto', 'AD': 'Comercial', 'AE': 'Cód. Cliente', 'AF': 'Prioridade', 'AG': 'Conf. Manual',
        'AH': 'Obs Setores', 'AI': 'Datas Previstas', 'AJ': 'Motivos Paragem', 'AK': 'Data Especial',
        'AL': 'Data Printer', 'AM': 'Data Debuxo', 'AN': 'Data Amostras', 'AO': 'Data Bordados',
        'AP': 'Arquivado', 'AQ': 'Data Arquivado', 'AR': 'Arquivado Por'
    };

    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([headerRow, ...excelRows], { skipHeader: true });

    // Auto-width simples
    ws['!cols'] = Array(45).fill({ wch: 18 });

    XLSX.utils.book_append_sheet(workbook, ws, 'Dados_BD');

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    const fileName = customFileName || `TexFlow_Export_Full_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

// --- DEFINIÇÃO GLOBAL DE TODAS AS COLUNAS DISPONÍVEIS PARA EXPORTAÇÃO ---
export interface ExportColumnDef {
  key: string;        // chave interna
  label: string;      // nome legível para o utilizador
  group: string;      // grupo para organização visual
}

export const ALL_EXPORT_COLUMNS: ExportColumnDef[] = [
  // Identificação
  { key: 'docNr',         label: 'Nr. Documento',       group: 'Identificação' },
  { key: 'itemNr',        label: 'Item',                group: 'Identificação' },
  { key: 'id',            label: 'ID Interno',           group: 'Identificação' },
  // Cliente
  { key: 'clientName',    label: 'Cliente',              group: 'Cliente' },
  { key: 'clientCode',    label: 'Cód. Cliente',         group: 'Cliente' },
  { key: 'comercial',     label: 'Comercial',            group: 'Cliente' },
  { key: 'po',            label: 'PO',                   group: 'Cliente' },
  // Artigo
  { key: 'articleCode',   label: 'Artigo',               group: 'Artigo' },
  { key: 'reference',     label: 'Referência',           group: 'Artigo' },
  { key: 'colorCode',     label: 'Cód. Cor',             group: 'Artigo' },
  { key: 'colorDesc',     label: 'Cor',                  group: 'Artigo' },
  { key: 'size',          label: 'Tamanho',              group: 'Artigo' },
  { key: 'sizeDesc',      label: 'Desc. Tamanho',        group: 'Artigo' },
  { key: 'family',        label: 'Família',              group: 'Artigo' },
  { key: 'ean',           label: 'EAN',                  group: 'Artigo' },
  // Quantidades
  { key: 'qtyRequested',  label: 'Qtd. Pedida',          group: 'Quantidades' },
  { key: 'qtyBilled',     label: 'Qtd. Faturada',        group: 'Quantidades' },
  { key: 'qtyOpen',       label: 'Qtd. Em Aberto',       group: 'Quantidades' },
  { key: 'felpoCruQty',   label: 'Qtd. Felpo Cru',       group: 'Quantidades' },
  { key: 'tinturariaQty', label: 'Qtd. Tinturaria',      group: 'Quantidades' },
  { key: 'confRoupoesQty',label: 'Qtd. Conf. Roupões',   group: 'Quantidades' },
  { key: 'confFelposQty', label: 'Qtd. Conf. Felpos',    group: 'Quantidades' },
  { key: 'embAcabQty',    label: 'Qtd. Embalagem',       group: 'Quantidades' },
  { key: 'stockCxQty',    label: 'Qtd. Stock Caixa',     group: 'Quantidades' },
  // Datas
  { key: 'issueDate',     label: 'Data Emissão',         group: 'Datas' },
  { key: 'requestedDate', label: 'Data Entrega Pedida',  group: 'Datas' },
  { key: 'dataEnt',       label: 'Data Entrada',         group: 'Datas' },
  { key: 'dataTec',       label: 'Data Tecelagem',       group: 'Datas' },
  { key: 'felpoCruDate',  label: 'Data Felpo Cru',       group: 'Datas' },
  { key: 'tinturariaDate',label: 'Data Tinturaria',      group: 'Datas' },
  { key: 'confDate',      label: 'Data Confecção',       group: 'Datas' },
  { key: 'armExpDate',    label: 'Data Prev. Armazém',   group: 'Datas' },
  // Datas Especiais
  { key: 'dataEspecial',  label: 'Data Especial',        group: 'Datas Especiais' },
  { key: 'dataPrinter',   label: 'Data Printer',         group: 'Datas Especiais' },
  { key: 'dataDebuxo',    label: 'Data Debuxo',          group: 'Datas Especiais' },
  { key: 'dataAmostras',  label: 'Data Amostras',        group: 'Datas Especiais' },
  { key: 'dataBordados',  label: 'Data Bordados',        group: 'Datas Especiais' },
  // Estado / Aplicação
  { key: 'estado',        label: 'Estado',               group: 'Estado / App' },
  { key: 'priority',      label: 'Prioridade',           group: 'Estado / App' },
  { key: 'isManual',      label: 'Conf. Manual',         group: 'Estado / App' },
  { key: 'isArchived',    label: 'Arquivado',            group: 'Estado / App' },
  { key: 'archivedAt',    label: 'Arquivado Em',         group: 'Estado / App' },
  { key: 'archivedBy',    label: 'Arquivado Por',        group: 'Estado / App' },
  // Observações por Sector
  { key: 'obs_tecelagem', label: 'Obs. Tecelagem',       group: 'Observações' },
  { key: 'obs_felpo_cru', label: 'Obs. Felpo Cru',       group: 'Observações' },
  { key: 'obs_tinturaria',label: 'Obs. Tinturaria',      group: 'Observações' },
  { key: 'obs_confeccao', label: 'Obs. Confecção',       group: 'Observações' },
  { key: 'obs_embalagem', label: 'Obs. Embalagem',       group: 'Observações' },
  { key: 'obs_expedicao', label: 'Obs. Expedição',       group: 'Observações' },
  // Datas Previstas por Sector
  { key: 'prev_tecelagem',label: 'Prev. Tecelagem',      group: 'Datas Previstas' },
  { key: 'prev_felpo_cru',label: 'Prev. Felpo Cru',      group: 'Datas Previstas' },
  { key: 'prev_tinturaria',label:'Prev. Tinturaria',     group: 'Datas Previstas' },
  { key: 'prev_confeccao',label: 'Prev. Confecção',      group: 'Datas Previstas' },
  { key: 'prev_embalagem',label: 'Prev. Embalagem',      group: 'Datas Previstas' },
  { key: 'prev_expedicao',label: 'Prev. Expedição',      group: 'Datas Previstas' },
  // Motivos de Paragem por Sector
  { key: 'stop_tecelagem',label: 'Motivo Tecelagem',     group: 'Motivos de Paragem' },
  { key: 'stop_felpo_cru',label: 'Motivo Felpo Cru',     group: 'Motivos de Paragem' },
  { key: 'stop_tinturaria',label:'Motivo Tinturaria',    group: 'Motivos de Paragem' },
  { key: 'stop_confeccao',label: 'Motivo Confecção',     group: 'Motivos de Paragem' },
  { key: 'stop_embalagem',label: 'Motivo Embalagem',     group: 'Motivos de Paragem' },
  { key: 'stop_expedicao',label: 'Motivo Expedição',     group: 'Motivos de Paragem' },
];

export const DEFAULT_SELECTED_COLUMNS: string[] = [
  'docNr', 'itemNr', 'clientName', 'comercial', 'po',
  'reference', 'colorDesc', 'sizeDesc', 'family',
  'qtyRequested', 'qtyOpen', 'requestedDate', 'estado', 'priority',
];

// --- PERSISTÊNCIA DE CONFIGURAÇÃO DE COLUNAS ---
export const saveExportColumnsConfig = async (selectedKeys: string[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EXPORT_COLUMNS, 'readwrite');
    tx.objectStore(STORE_EXPORT_COLUMNS).put(selectedKeys, 'config');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadExportColumnsConfig = async (): Promise<string[] | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_EXPORT_COLUMNS, 'readonly');
    const req = tx.objectStore(STORE_EXPORT_COLUMNS).get('config');
    tx.oncomplete = () => resolve(req.result || null);
    tx.onerror = () => resolve(null);
  });
};

// Helper para obter o valor de uma coluna a partir de uma Order
const getColumnValue = (order: Order, key: string): any => {
  const dateFields = ['issueDate','requestedDate','dataEnt','dataTec','felpoCruDate',
    'tinturariaDate','confDate','armExpDate','dataEspecial','dataPrinter',
    'dataDebuxo','dataAmostras','dataBordados','archivedAt'];

  if (key === 'estado') return getOrderState(order);
  if (key === 'priority') return order.priority === 1 ? 'Alta' : order.priority === 2 ? 'Média' : order.priority === 3 ? 'Baixa' : '';
  if (key === 'isManual') return order.isManual ? 'Sim' : 'Não';
  if (key === 'isArchived') return order.isArchived ? 'Sim' : 'Não';

  if (key.startsWith('obs_')) {
    const sectorId = key.replace('obs_', '');
    return order.sectorObservations?.[sectorId] || '';
  }
  if (key.startsWith('prev_')) {
    const sectorId = key.replace('prev_', '');
    return formatDate(order.sectorPredictedDates?.[sectorId]);
  }
  if (key.startsWith('stop_')) {
    const sectorId = key.replace('stop_', '');
    return order.sectorStopReasons?.[sectorId] || '';
  }

  const val = (order as any)[key];
  if (dateFields.includes(key) && val) return formatDate(val);
  return val ?? '';
};

// --- EXPORTAÇÃO PERSONALIZADA (com colunas e ordem configuradas) ---
export const exportCustomColumns = (
  orders: Order[],
  selectedColumnKeys: string[],
  customFileName?: string
) => {
  if (orders.length === 0 || selectedColumnKeys.length === 0) return;

  const colDefs = selectedColumnKeys
    .map(k => ALL_EXPORT_COLUMNS.find(c => c.key === k))
    .filter(Boolean) as ExportColumnDef[];

  const sheetData = orders.map(order => {
    const row: Record<string, any> = {};
    colDefs.forEach(col => {
      row[col.label] = getColumnValue(order, col.key);
    });
    return row;
  });

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws['!cols'] = Array(colDefs.length).fill({ wch: 22 });
  XLSX.utils.book_append_sheet(workbook, ws, 'Exportação');

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  const fileName = customFileName || `TexFlow_Personalizado_${dateStr}_${timeStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const generateMockOrders = (count: number = 20): Order[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${i}`,
    docNr: `ENC-2024-${1000 + i}`,
    clientCode: `C${100 + i}`,
    clientName: "CLIENTE EXEMPLO " + i,
    comercial: "COMERCIAL " + (i % 3 + 1),
    issueDate: new Date(),
    requestedDate: new Date(Date.now() + 86400000 * 10),
    itemNr: 1,
    po: `PO-${5000 + i}`,
    articleCode: `ART-${200 + i}`,
    reference: `REF-${300 + i}`,
    colorCode: "COR-01",
    colorDesc: "AZUL",
    size: "L",
    family: "BANHO",
    sizeDesc: "100x150",
    ean: "5601234567890",
    qtyRequested: 100,
    dataTec: new Date(),
    felpoCruQty: 0, felpoCruDate: null,
    tinturariaQty: 0, tinturariaDate: null,
    confRoupoesQty: 0, confFelposQty: 0, confDate: null,
    embAcabQty: 0, armExpDate: null,
    stockCxQty: 0,
    dataEnt: new Date(Date.now() + 86400000 * 10),
    dataEspecial: null, dataPrinter: null, dataDebuxo: null, dataAmostras: null, dataBordados: null,
    qtyBilled: 0, qtyOpen: 100,
    sectorObservations: {},
    priority: 0,
    isManual: false
  }));
};

export const parseDataFile = async (file: File): Promise<{ orders: Order[], headers: Record<string, string> }> => {
    if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        return parseSQLiteFile(file);
    }
    return parseExcelFile(file);
};
