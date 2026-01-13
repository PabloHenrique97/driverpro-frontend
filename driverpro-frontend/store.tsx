import React, { createContext, useContext, useState, ReactNode, PropsWithChildren } from 'react';
import { User, UserRole, TaskRequest, RequestStatus, AppNotification, Vehicle } from './types';

// Mock Data Generators for Users/Notifications (Random String)
const generateId = () => Math.random().toString(36).substr(2, 9);

// Sequential ID Generator for Requests (000001 - 999999)
const generateRequestId = (currentRequests: TaskRequest[]): string => {
  let maxId = 0;
  
  // Find highest numeric ID
  currentRequests.forEach(req => {
    const parsed = parseInt(req.id, 10);
    if (!isNaN(parsed)) {
      if (parsed > maxId) maxId = parsed;
    }
  });

  let nextId = maxId + 1;
  
  // Reset if overflow
  if (nextId > 999999) nextId = 1;

  // Format as 6 digits padded with zeros
  return nextId.toString().padStart(6, '0');
};

// Mock Vehicles
const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', model: 'Fiat Strada', plate: 'SNF1J40', tag: 'CA163', hourlyRate: 24.56 }
];

const MOCK_USERS: User[] = [
  // 1. Administrador Principal
  { id: 'u1', name: 'Administrador', email: 'admin@empresa.com', cpf: '123.456.789-10', password: '654321', role: UserRole.ADMIN, cr: '0000' },
  
  // 2. Solicitante + Admin (Antonio Carlos)
  { id: 'u2', name: 'Antonio Carlos', email: 'antonio@edeconsil.com.br', cpf: '026.711.533-41', password: '946831', role: UserRole.SOLICITOR_ADMIN, cr: '2990' },
  
  // 3. Motorista (Lindoval)
  { id: 'u3', name: 'Lindoval Everton Pinheiro', email: 'cd@edeconsil.com.br', cpf: '003.502.913-73', password: '241109', role: UserRole.DRIVER, cr: '2990', defaultVehicleId: 'v1' },

  // 4. Grupo de Solicitantes - CR 2990
  { id: 's1', name: 'Alessandra Monteiro', email: 'suprimentos@edeconsil.com.br', cpf: '629.481.803-68', password: '584218', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's2', name: 'Aldair Muniz França', email: 'cd@edeconsil.com.br', cpf: '044.701.543-50', password: '123456', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's3', name: 'Stelydan Amorim Lima', email: 'cd.distrito@edeconsil.com.br', cpf: '014.611.443-45', password: '1984', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's4', name: 'Pablo Roberto', email: 'suprimentos@edeconsil.com.br', cpf: '029.404.303-90', password: '250190', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's5', name: 'Junior Texeira', email: 'suprimentos@edeconsil.com.br', cpf: '753.582.393-91', password: '210779', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's6', name: 'Eudalia dos Reis da Mata', email: 'cd.distrito@edeconsil.com.br', cpf: '607.292.383-69', password: '6072', role: UserRole.SOLICITOR, cr: '2990' },
  { id: 's7', name: 'Luiz Nelson dos Santos Silva', email: 'cd.distrito@edeconsil.com.br', cpf: '603.026.723-03', password: '1201', role: UserRole.SOLICITOR, cr: '2990' },
];

const MOCK_REQUESTS: TaskRequest[] = [];

interface AppContextType {
  currentUser: User | null;
  users: User[];
  vehicles: Vehicle[];
  requests: TaskRequest[];
  notifications: AppNotification[];
  isLoading: boolean;
  refreshData: () => void;
  login: (cpf: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: User) => void;
  editUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  editVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  createRequest: (req: Omit<TaskRequest, 'id' | 'createdAt' | 'status' | 'travelDuration' | 'workDuration'>) => string;
  updateRequestStatus: (id: string, status: RequestStatus, updates?: Partial<TaskRequest>) => void;
  assignDriver: (requestId: string, driverId: string) => void;
  markNotificationAsRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: PropsWithChildren<{}>) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [requests, setRequests] = useState<TaskRequest[]>(MOCK_REQUESTS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = () => {
    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
        setIsLoading(false);
    }, 800);
  };

  const login = (cpf: string, password: string): boolean => {
    // Remove non-numeric chars for flexible comparison
    const cleanInputCpf = cpf.replace(/\D/g, '');
    
    const user = users.find(u => {
        const cleanUserCpf = u.cpf.replace(/\D/g, '');
        // Loose comparison for password to allow simple strings
        return cleanUserCpf === cleanInputCpf && u.password == password;
    });

    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => setCurrentUser(null);

  const addUser = (user: User) => {
    setUsers(prev => [...prev, { ...user, id: generateId() }]);
  };

  const editUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  // Vehicle CRUD
  const addVehicle = (vehicle: Omit<Vehicle, 'id'>) => {
      setVehicles(prev => [...prev, { ...vehicle, id: generateId() }]);
  };

  const editVehicle = (id: string, updates: Partial<Vehicle>) => {
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVehicle = (id: string) => {
      setVehicles(prev => prev.filter(v => v.id !== id));
      // Opcional: Remover referência de defaultVehicleId dos usuários se necessário, 
      // mas por simplicidade deixaremos apenas o veículo sumir da lista.
  };

  const createRequest = (req: Omit<TaskRequest, 'id' | 'createdAt' | 'status' | 'travelDuration' | 'workDuration'>): string => {
    const nextId = generateRequestId(requests);
    setRequests(prev => {
        const newRequest: TaskRequest = {
            ...req,
            id: nextId,
            status: RequestStatus.PENDING,
            createdAt: Date.now(),
            travelDuration: 0,
            workDuration: 0,
        };
        return [newRequest, ...prev];
    });
    return nextId;
  };

  const addNotification = (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newNote: AppNotification = {
      id: generateId(),
      userId,
      title,
      message,
      type,
      read: false,
      timestamp: Date.now()
    };
    setNotifications(prev => [newNote, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const updateRequestStatus = (id: string, status: RequestStatus, updates?: Partial<TaskRequest>) => {
    setRequests(prev => {
      // Find the request first to access current data
      const targetRequest = prev.find(r => r.id === id);
      
      let finalUpdates = { ...updates };

      // --- Lógica de Custo ao Concluir (BASEADO NO VEÍCULO) ---
      if (status === RequestStatus.COMPLETED && targetRequest) {
          // Determina qual veículo foi usado. 
          // Pode vir no updates (se o motorista mudou no último segundo) ou do targetRequest.
          const usedVehicleId = (updates as any)?.vehicleId || targetRequest.vehicleId;
          
          if (usedVehicleId) {
              const vehicle = vehicles.find(v => v.id === usedVehicleId);
              
              if (vehicle && vehicle.hourlyRate) {
                  // Calcular tempo total em horas
                  const durationUpdates = updates as any;
                  const newWorkDuration = durationUpdates.workDuration !== undefined ? durationUpdates.workDuration : targetRequest.workDuration;
                  
                  const totalSeconds = targetRequest.travelDuration + newWorkDuration;
                  const totalHours = totalSeconds / 3600;
                  const cost = totalHours * vehicle.hourlyRate;

                  finalUpdates = {
                      ...finalUpdates,
                      finalCost: Number(cost.toFixed(2)),
                      hourlyRateApplied: vehicle.hourlyRate
                  };
              }
          }
      }
      
      if (targetRequest) {
        // --- Notificação para o SOLICITANTE ---
        let title = '';
        let message = '';
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';

        if (status === RequestStatus.ACCEPTED) {
            if (updates?.restartReason) {
                title = 'Atendimento Reiniciado';
                message = `O motorista reiniciou o atendimento da tarefa. Motivo: ${updates.restartReason}`;
                type = 'warning';
            } else {
                title = 'Solicitação Aceita';
                message = `O motorista aceitou sua tarefa para: ${targetRequest.destination}`;
                type = 'info';
            }
        } else if (status === RequestStatus.IN_TRANSIT) {
            title = 'Motorista a Caminho';
            message = `O motorista iniciou a rota para: ${targetRequest.destination}`;
            type = 'info';
        } else if (status === RequestStatus.EXECUTING) {
            title = 'Em Execução';
            message = `O motorista chegou ao local e iniciou a tarefa.`;
            type = 'warning';
        } else if (status === RequestStatus.COMPLETED) {
            title = 'Tarefa Concluída';
            message = `A tarefa em ${targetRequest.destination} foi finalizada com sucesso!`;
            type = 'success';
        } else if (status === RequestStatus.REJECTED) {
            title = 'Solicitação Recusada';
            message = `Sua solicitação para ${targetRequest.destination} não pôde ser atendida.`;
            type = 'warning';
        }

        if (title && targetRequest.solicitorId) {
             if (status !== RequestStatus.CANCELLED) {
                 addNotification(targetRequest.solicitorId, title, message, type);
             }
        }

        if (status === RequestStatus.CANCELLED && targetRequest.driverId) {
             addNotification(
                targetRequest.driverId,
                'Tarefa Cancelada',
                `A tarefa #${targetRequest.id} para ${targetRequest.destination} foi cancelada pelo solicitante.`,
                'error'
             );
        }
      }

      return prev.map(r => r.id === id ? { ...r, status, ...finalUpdates } : r);
    });
  };

  const assignDriver = (requestId: string, driverId: string) => {
    const driver = users.find(u => u.id === driverId);
    if (!driver) return;
    
    // Se o motorista tem veículo padrão, já atribui aqui se não foi definido
    const updates: Partial<TaskRequest> = { driverId, driverName: driver.name, acceptedAt: Date.now() };
    if (driver.defaultVehicleId) {
        const v = vehicles.find(veh => veh.id === driver.defaultVehicleId);
        if (v) {
            updates.vehicleId = v.id;
            updates.vehicleSnapshot = `${v.model} (${v.plate})`;
        }
    }

    updateRequestStatus(requestId, RequestStatus.ACCEPTED, updates);
  };

  return (
    <AppContext.Provider value={{ currentUser, users, vehicles, requests, notifications, isLoading, refreshData, login, logout, addUser, editUser, deleteUser, addVehicle, editVehicle, deleteVehicle, createRequest, updateRequestStatus, assignDriver, markNotificationAsRead }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};