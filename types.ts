export enum UserRole {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  SOLICITOR = 'SOLICITOR',
  SOLICITOR_ADMIN = 'SOLICITOR_ADMIN', // Novo perfil híbrido
}

export enum RequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED', // Novo status
}

export enum TaskPriority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT',
  URGENT = 'URGENT',
}

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  tag?: string;
  hourlyRate?: number; // Moved from User to Vehicle
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  password?: string; // Added for authentication
  role: UserRole;
  avatar?: string;
  cr?: string; // Centro de Resultado
  defaultVehicleId?: string; // ID do veículo padrão
}

export interface TaskRequest {
  id: string;
  solicitorId: string;
  solicitorName: string;
  driverId?: string; // Assigned driver
  driverName?: string;
  
  origin: string; // Origin defined by solicitor (or default)
  driverStartLocation?: string; // Manually entered by driver
  destination: string;
  taskDescription: string;
  notes?: string;
  attachmentUrl?: string; // Simulate file upload
  cr?: string; // Centro de Resultado da solicitação
  cc?: string; // Centro de Custo (C.C)
  priority?: TaskPriority; // Prioridade da tarefa

  status: RequestStatus;
  
  // Timestamps
  createdAt: number;
  acceptedAt?: number;
  travelStartAt?: number;
  workStartAt?: number; // Arrival at destination
  completedAt?: number;
  cancelledAt?: number; // Data do cancelamento

  // Durations (in seconds)
  travelDuration: number;
  workDuration: number;
  
  // Metrics & GPS
  tripDistanceKm?: number; // Calculated automatically
  startLat?: number;
  startLng?: number;

  driverNotes?: string;
  driverAttachmentUrl?: string; // Foto tirada pelo motorista
  
  cancellationReason?: string; // Motivo do cancelamento pelo solicitante
  restartReason?: string; // Motivo do reinício pelo motorista
  rejectionReason?: string; // Motivo da recusa pelo motorista

  // Novos campos: Veículo e Custo
  vehicleId?: string;
  vehicleSnapshot?: string; // Modelo/Placa salvos como string para histórico
  finalCost?: number; // Custo final calculado (Histórico financeiro)
  hourlyRateApplied?: number; // Taxa aplicada no momento do cálculo
}

export interface DashboardStats {
  avgTravelTime: number;
  avgTaskTime: number;
  totalTripsToday: number;
  totalTasksToday: number;
  tasksPerDriver: { name: string; count: number }[];
  requestsPerUser: { name: string; count: number }[];
  dailyActivity: { date: string; trips: number; tasks: number }[];
  totalCostPeriod: number; // Novo KPI financeiro
}

export interface AppNotification {
  id: string;
  userId: string; // Target user
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: number;
}