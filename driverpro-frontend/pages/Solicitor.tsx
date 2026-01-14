import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../store';
import { RequestStatus, UserRole, TaskRequest, TaskPriority } from '../types';
import { Plus, MapPin, Check, Truck, Clock, User as UserIcon, Paperclip, X, Navigation, PlayCircle, Flag, XCircle, RefreshCw, Building, CreditCard, MessageSquare, Camera, Filter, FileText, Download, AlertTriangle, Zap, Calendar, Ban, AlertCircle, Radio, User, DollarSign, Car, FileSpreadsheet, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Mapa de Tradução de Status
const STATUS_PT = {
    [RequestStatus.PENDING]: 'Pendente',
    [RequestStatus.ACCEPTED]: 'Aceito',
    [RequestStatus.IN_TRANSIT]: 'Em Rota',
    [RequestStatus.EXECUTING]: 'Executando',
    [RequestStatus.COMPLETED]: 'Concluído',
    [RequestStatus.REJECTED]: 'Recusado',
    [RequestStatus.CANCELLED]: 'Cancelado',
};

const FleetStatus = ({ requests }: { requests: TaskRequest[] }) => {
    // Filter for active drivers
    const activeTasks = requests.filter(r => 
        r.status === RequestStatus.IN_TRANSIT || r.status === RequestStatus.EXECUTING
    );

    return (
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl mb-8 border border-slate-700">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
                <div className="relative">
                    <Radio className="w-5 h-5 text-green-400" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                </div>
                <h3 className="font-bold text-lg">Status da Frota em Tempo Real</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTasks.length === 0 ? (
                    <div className="col-span-full text-center py-6 text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                        Nenhum motorista em rota ou execução no momento.
                    </div>
                ) : (
                    activeTasks.map(task => (
                        <div key={task.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 relative overflow-hidden">
                            {/* Status Stripe */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.status === RequestStatus.IN_TRANSIT ? 'bg-indigo-500' : 'bg-green-500'}`} />
                            
                            <div className="flex justify-between items-start mb-2 pl-2">
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-700 p-1.5 rounded-full">
                                        <Truck className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <span className="font-bold text-sm truncate max-w-[120px]">{task.driverName || 'Motorista'}</span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${task.status === RequestStatus.IN_TRANSIT ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
                                    {STATUS_PT[task.status]}
                                </span>
                            </div>

                            <div className="pl-2 space-y-2">
                                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> 
                                    Atendendo: <span className="text-white font-medium">{task.solicitorName}</span>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" />
                                    Destino: <span className="text-slate-300 truncate">{task.destination}</span>
                                </div>
                                {task.vehicleSnapshot && (
                                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <Car className="w-3 h-3" /> {task.vehicleSnapshot}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ProgressRuler = ({ request }: { request: TaskRequest }) => {
    const status = request.status;
    // Determine current step index
    let stepIndex = 0;
    if (status === RequestStatus.ACCEPTED) stepIndex = 1;
    if (status === RequestStatus.IN_TRANSIT) stepIndex = 2;
    if (status === RequestStatus.EXECUTING) stepIndex = 3;
    if (status === RequestStatus.COMPLETED) stepIndex = 4;
    
    const isRejected = status === RequestStatus.REJECTED;
    const isCancelled = status === RequestStatus.CANCELLED;

    const steps = [
        { icon: Clock, label: "Pendente", time: request.createdAt },
        { icon: Check, label: "Aceito", time: request.acceptedAt },
        { icon: Truck, label: "Em Rota", time: request.travelStartAt },
        { icon: PlayCircle, label: "Executando", time: request.workStartAt },
        { icon: Flag, label: "Concluído", time: request.completedAt },
    ];

    const formatDateTime = (ts?: number) => {
        if (!ts) return '';
        return new Date(ts).toLocaleString('pt-BR', { 
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
    };

    if (isRejected) {
        return (
             <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-500" />
                    <span className="text-red-700 font-medium">Solicitação recusada pelo motorista.</span>
                </div>
                {request.rejectionReason && (
                    <div className="text-sm bg-white p-2 rounded border border-red-200 text-red-800 mt-1">
                        <span className="font-bold">Motivo:</span> {request.rejectionReason}
                    </div>
                )}
             </div>
        )
    }

    if (isCancelled) {
        return (
             <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <Ban className="w-6 h-6 text-slate-500" />
                    <span className="text-slate-700 font-bold">Solicitação Cancelada</span>
                    <span className="text-xs text-slate-400 ml-auto">{formatDateTime(request.cancelledAt)}</span>
                </div>
                {request.cancellationReason && (
                    <div className="text-sm text-slate-600 bg-white p-2 rounded border border-slate-200">
                        <span className="font-bold">Motivo:</span> {request.cancellationReason}
                    </div>
                )}
             </div>
        )
    }

    return (
        <div className="w-full py-4 overflow-x-auto">
            <div className="flex items-center justify-between relative min-w-[300px]">
                {/* Connecting Line - Background */}
                <div className="absolute top-4 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
                
                {/* Connecting Line - Progress */}
                <div 
                    className="absolute top-4 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 rounded-full transition-all duration-700"
                    style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, idx) => {
                    const isActive = idx <= stepIndex;
                    const isCurrent = idx === stepIndex;
                    const Icon = step.icon;
                    
                    return (
                        <div key={idx} className="relative z-10 flex flex-col items-center gap-2 group min-w-[60px]">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2
                                ${isActive ? 'bg-green-500 border-green-500 text-white shadow-md scale-110' : 'bg-white border-slate-300 text-slate-300'}
                                ${isCurrent && status !== RequestStatus.COMPLETED ? 'animate-pulse ring-4 ring-green-100' : ''}
                            `}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col items-center text-center">
                                <span className={`
                                    text-[10px] font-bold uppercase tracking-wider transition-colors
                                    ${isActive ? 'text-green-600' : 'text-slate-300'}
                                `}>
                                    {step.label}
                                </span>
                                {step.time && (
                                    <span className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                        {formatDateTime(step.time)}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface SolicitorDashboardProps {
    view: 'requests' | 'create-request' | 'fleet-monitor';
}

export const SolicitorDashboard = ({ view }: SolicitorDashboardProps) => {
  const { currentUser, createRequest, requests, users, refreshData, isLoading, updateRequestStatus, vehicles } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter States
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDriverId, setFilterDriverId] = useState('ALL');

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    destination: '',
    taskDescription: '',
    notes: '',
    driverId: '',
    cc: '', // Campo C.C
    priority: TaskPriority.NORMAL // Default priority
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const selectedDriver = users.find(u => u.id === formData.driverId);
    const attachmentUrl = selectedFile ? URL.createObjectURL(selectedFile) : undefined;

    const newRequestId = createRequest({
      solicitorId: currentUser.id,
      solicitorName: currentUser.name,
      driverId: selectedDriver?.id,
      driverName: selectedDriver?.name,
      origin: 'Localização Atual',
      destination: formData.destination,
      taskDescription: formData.taskDescription,
      notes: formData.notes,
      attachmentUrl: attachmentUrl,
      cr: currentUser.cr,
      cc: formData.cc,
      priority: formData.priority,
    });
    
    setFormData({ destination: '', taskDescription: '', notes: '', driverId: '', cc: '', priority: TaskPriority.NORMAL });
    setSelectedFile(null);
    alert(`Solicitação #${newRequestId} criada com sucesso! Verifique em "Minhas Solicitações".`);
  };

  // Cancel Logic
  const openCancelModal = (reqId: string) => {
      setRequestToCancel(reqId);
      setCancelReason('');
      setCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
      if (!requestToCancel || !cancelReason.trim()) {
          alert("Por favor, informe o motivo do cancelamento.");
          return;
      }
      
      updateRequestStatus(requestToCancel, RequestStatus.CANCELLED, {
          cancellationReason: cancelReason,
          cancelledAt: Date.now()
      });

      setCancelModalOpen(false);
      setRequestToCancel(null);
      setCancelReason('');
  };

  // Filter Logic
  const myRequests = useMemo(() => {
     let filtered = requests.filter(r => r.solicitorId === currentUser?.id);

     // Date Filter
     if (filterStartDate) {
         const start = new Date(filterStartDate);
         start.setHours(0,0,0,0);
         filtered = filtered.filter(r => new Date(r.createdAt) >= start);
     }
     if (filterEndDate) {
         const end = new Date(filterEndDate);
         end.setHours(23,59,59,999);
         filtered = filtered.filter(r => new Date(r.createdAt) <= end);
     }

     // Status Filter
     if (filterStatus !== 'ALL') {
         filtered = filtered.filter(r => r.status === filterStatus);
     }

     // Driver Filter
     if (filterDriverId !== 'ALL') {
         filtered = filtered.filter(r => r.driverId === filterDriverId);
     }

     return filtered.sort((a,b) => b.createdAt - a.createdAt);
  }, [requests, currentUser, filterStartDate, filterEndDate, filterStatus, filterDriverId]);
  
  // Filter Drivers by CR dynamically based on Current User CR
  const drivers = users.filter(u => {
      if (u.role !== UserRole.DRIVER) return false;
      if (currentUser?.cr && u.cr !== currentUser.cr) return false;
      return true;
  });

  const getVehicleDetails = (vehicleId?: string) => {
    if (!vehicleId) return { model: '-', tag: '-', plate: '-' };
    const v = vehicles.find(veh => veh.id === vehicleId);
    return v ? { model: v.model, tag: v.tag || '-', plate: v.plate } : { model: 'Desconhecido', tag: '-', plate: '-' };
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '-';
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  // Helper to render priority badge
  const renderPriorityBadge = (priority?: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">
            <AlertTriangle className="w-3 h-3" /> URGENTE - Agora
          </span>
        );
      case TaskPriority.IMPORTANT:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">
            <Zap className="w-3 h-3" /> IMPORTANTE - Hoje
          </span>
        );
      case TaskPriority.NORMAL:
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
            <Calendar className="w-3 h-3" /> NORMAL - 2 Dias
          </span>
        );
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    const styles = {
        [RequestStatus.PENDING]: 'bg-amber-100 text-amber-700',
        [RequestStatus.ACCEPTED]: 'bg-blue-100 text-blue-700',
        [RequestStatus.IN_TRANSIT]: 'bg-indigo-100 text-indigo-700',
        [RequestStatus.EXECUTING]: 'bg-purple-100 text-purple-700',
        [RequestStatus.COMPLETED]: 'bg-green-100 text-green-700',
        [RequestStatus.REJECTED]: 'bg-red-100 text-red-700',
        [RequestStatus.CANCELLED]: 'bg-slate-200 text-slate-600',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
            {STATUS_PT[status] || status}
        </span>
    );
  };

  // Export PDF Logic (List View)
  const handleExportPDF = () => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Histórico de Solicitações - DriverPro", 14, 20);
      doc.setFontSize(10);
      doc.text(`Solicitante: ${currentUser?.name}`, 14, 26);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 31);

      const tableData = myRequests.map(req => [
          req.id,
          new Date(req.createdAt).toLocaleDateString(),
          STATUS_PT[req.status],
          req.priority || 'NORMAL',
          req.driverName || 'N/A',
          req.finalCost ? `R$ ${req.finalCost.toFixed(2)}` : '-',
          req.destination,
          req.taskDescription,
          req.driverNotes || '-',
      ]);

      autoTable(doc, {
          head: [['ID', 'Data', 'Status', 'Prior.', 'Motorista', 'Custo', 'Destino', 'Tarefa', 'Obs.']],
          body: tableData,
          startY: 40,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [30, 41, 59] }
      });
      doc.save(`Historico_Solicitacoes_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // --- Monitor Export Functions ---
  const handleMonitorExportExcel = () => {
      const data = myRequests.map(req => {
          const v = getVehicleDetails(req.vehicleId);
          return {
              ID: req.id,
              Status: STATUS_PT[req.status],
              'C.C': req.cc || '-',
              Motorista: req.driverName || '-',
              Veículo: v.model !== '-' ? `${v.model} (${v.plate})` : '-',
              'Custo Final': req.finalCost ? req.finalCost.toFixed(2) : '-',
              Destino: req.destination,
              Data: new Date(req.createdAt).toLocaleDateString()
          };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Monitoramento");
      XLSX.writeFile(wb, `Monitoramento_Frota_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleMonitorExportPDF = () => {
      const doc = new jsPDF();
      doc.text("Monitoramento da Frota - DriverPro", 14, 20);
      doc.setFontSize(10);
      doc.text(`Solicitante: ${currentUser?.name}`, 14, 26);
      doc.text(`Período: ${filterStartDate || 'Início'} até ${filterEndDate || 'Hoje'}`, 14, 31);

      const tableData = myRequests.map(req => {
          const v = getVehicleDetails(req.vehicleId);
          return [
              req.id,
              STATUS_PT[req.status],
              req.cc || '-',
              req.driverName || '-',
              v.model !== '-' ? v.model : '-',
              req.finalCost ? `R$ ${req.finalCost.toFixed(2)}` : '-',
              req.destination,
              new Date(req.createdAt).toLocaleDateString()
          ];
      });

      autoTable(doc, {
          head: [['ID', 'Status', 'C.C', 'Motorista', 'Veículo', 'Custo', 'Destino', 'Data']],
          body: tableData,
          startY: 40,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [30, 41, 59] }
      });
      doc.save(`Monitoramento_Frota_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 relative">
      
      {/* CANCEL MODAL */}
      {cancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center gap-3 text-red-600 mb-4 border-b border-red-100 pb-3">
                      <AlertCircle className="w-6 h-6" />
                      <h3 className="text-lg font-bold">Cancelar Solicitação</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                      Tem certeza que deseja cancelar esta tarefa? O motorista será notificado imediatamente.
                      <br/><span className="font-bold">Esta ação não pode ser desfeita.</span>
                  </p>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Motivo do Cancelamento <span className="text-red-500">*</span></label>
                  <textarea 
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-6"
                      rows={3}
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                  />
                  <div className="flex gap-3 justify-end">
                      <button onClick={() => setCancelModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Voltar</button>
                      <button onClick={handleConfirmCancel} disabled={!cancelReason.trim()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg transition disabled:opacity-50">Confirmar Cancelamento</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER SECTION */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
            {view === 'create-request' ? 'Nova Solicitação' : view === 'fleet-monitor' ? 'Monitoramento da Frota' : 'Minhas Solicitações'}
        </h1>
        <p className="text-slate-500 mb-6">
            {view === 'create-request' ? 'Preencha o formulário abaixo para criar uma nova tarefa.' : view === 'fleet-monitor' ? 'Visualize o status detalhado das suas solicitações.' : 'Acompanhe o status das suas tarefas e custos em tempo real.'}
        </p>
        
        {/* Real-Time Fleet Monitor - Show only on List View */}
        {view === 'requests' && (
            <>
                <FleetStatus requests={requests} />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex gap-2 ml-auto">
                        <button onClick={refreshData} className={`p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm flex items-center gap-2 ${isLoading ? 'opacity-50' : ''}`} disabled={isLoading}>
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> <span className="text-sm font-medium hidden sm:inline">Atualizar</span>
                        </button>
                    </div>
                </div>
            </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section - Only show when view is create-request */}
        {view === 'create-request' && (
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
            <h2 className="text-lg font-bold mb-4 text-slate-800">Detalhes da Tarefa</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                    <select className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}>
                        <option value={TaskPriority.NORMAL}>Normal - Resolver em 2 dias</option>
                        <option value={TaskPriority.IMPORTANT}>Importante - Resolver hoje</option>
                        <option value={TaskPriority.URGENT}>Urgente - Resolver agora</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">C.C (Centro de Custo)</label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input required type="text" className="w-full border rounded-lg pl-9 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Informe o C.C" value={formData.cc} onChange={e => setFormData({...formData, cc: e.target.value})} />
                    </div>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motorista</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <select required className="w-full border rounded-lg pl-9 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white" value={formData.driverId} onChange={e => setFormData({...formData, driverId: e.target.value})}>
                    <option value="">Selecione um motorista...</option>
                    {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                  </select>
                </div>
              </div>

              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destino</label><input required type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tarefa</label><input required type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.taskDescription} onChange={e => setFormData({...formData, taskDescription: e.target.value})} /></div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anexo</label>
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange}/>
                <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  {selectedFile ? <><div className="flex items-center gap-2 text-green-700 font-medium break-all"><Paperclip className="w-4 h-4" /> <span className="text-sm">{selectedFile.name}</span></div><button onClick={removeFile} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Remover</button></> : <><Paperclip className="w-6 h-6 text-slate-400" /><span className="text-xs text-slate-500">Clique para anexar PDF ou JPG</span></>}
                </div>
              </div>
              
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Observações</label><textarea className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-lg">Enviar Solicitação</button>
            </form>
          </div>
        )}

        {/* Fleet Monitor View */}
        {view === 'fleet-monitor' && (
            <div className="col-span-full">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                         <div className="flex items-center gap-3">
                             <h2 className="text-lg font-bold text-slate-800">Tabela de Monitoramento</h2>
                             <button onClick={refreshData} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm bg-slate-50 px-2 py-1 rounded">
                                 <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                             </button>
                         </div>
                         
                         <div className="flex flex-wrap items-center gap-3">
                             <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">
                                 <span className="text-xs font-bold text-slate-500 uppercase">Período</span>
                                 <input type="date" className="bg-transparent text-sm outline-none w-32" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                                 <span className="text-slate-400">-</span>
                                 <input type="date" className="bg-transparent text-sm outline-none w-32" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                             </div>
                             
                             <button onClick={handleMonitorExportExcel} className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-sm hover:bg-green-100 transition" title="Baixar Excel">
                                 <FileSpreadsheet className="w-4 h-4" /> Excel
                             </button>
                             <button onClick={handleMonitorExportPDF} className="flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-sm hover:bg-red-100 transition" title="Baixar PDF">
                                 <FileText className="w-4 h-4" /> PDF
                             </button>
                         </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider bg-slate-50">
                                    <th className="py-3 px-4">ID</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">C.C</th>
                                    <th className="py-3 px-4">Motorista</th>
                                    <th className="py-3 px-4">Veículo</th>
                                    <th className="py-3 px-4 text-center">Custo Final</th>
                                    <th className="py-3 px-4">Destino</th>
                                    <th className="py-3 px-4 text-center">Tempos</th>
                                    <th className="py-3 px-4 text-right">Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myRequests.length === 0 ? (
                                    <tr><td colSpan={9} className="py-8 text-center text-slate-400 text-sm">Nenhuma solicitação encontrada neste período.</td></tr>
                                ) : (
                                    myRequests.map(req => {
                                        const vDetails = getVehicleDetails(req.vehicleId);
                                        return (
                                            <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                                                <td className="py-3 px-4 text-slate-400 font-mono text-xs">#{req.id}</td>
                                                <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                                                <td className="py-3 px-4 font-mono text-xs text-slate-600">{req.cc || '-'}</td>
                                                <td className="py-3 px-4 font-medium text-slate-700">
                                                    {req.driverName || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 text-xs">
                                                    {vDetails.model !== '-' ? `${vDetails.model} (${vDetails.plate})` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                                                    {req.finalCost ? `R$ ${req.finalCost.toFixed(2)}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs truncate" title={req.destination}>{req.destination}</td>
                                                <td className="py-3 px-4 text-center text-xs">
                                                    <div>🚗 {formatDuration(req.travelDuration)}</div>
                                                    <div>🔨 {formatDuration(req.workDuration)}</div>
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-500 text-xs">
                                                    {new Date(req.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
               </div>
            </div>
        )}

        {/* List Section - Only show when view is requests */}
        {view === 'requests' && (
        <div className="lg:col-span-3">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center">
             <div className="flex items-center gap-2 text-slate-700 font-bold text-sm border-r border-slate-200 pr-4 mr-2"><Filter className="w-4 h-4" /> Filtros</div>
             <div className="flex items-center gap-2"><span className="text-xs text-slate-500 font-bold uppercase">Início</span><input type="date" className="border rounded px-2 py-1 text-sm bg-slate-50" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} /></div>
             <div className="flex items-center gap-2"><span className="text-xs text-slate-500 font-bold uppercase">Fim</span><input type="date" className="border rounded px-2 py-1 text-sm bg-slate-50" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} /></div>
             <select className="border rounded px-2 py-1 text-sm bg-slate-50 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="ALL">Todos Status</option>
                <option value={RequestStatus.PENDING}>Pendente</option>
                <option value={RequestStatus.ACCEPTED}>Aceito</option>
                <option value={RequestStatus.IN_TRANSIT}>Em Rota</option>
                <option value={RequestStatus.COMPLETED}>Concluído</option>
                <option value={RequestStatus.CANCELLED}>Cancelado</option>
             </select>
             <button onClick={handleExportPDF} className="ml-auto flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"><Download className="w-4 h-4" /> Baixar PDF</button>
          </div>

          <div className="space-y-6">
            {myRequests.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300"><p className="text-slate-500">Nenhuma solicitação encontrada para os filtros aplicados.</p></div>
            ) : (
              myRequests.map(req => (
                <div key={req.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition relative group">
                  <div className="flex flex-col md:flex-row justify-between md:items-start mb-6 gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${req.status === RequestStatus.CANCELLED ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                        {req.status === RequestStatus.CANCELLED ? <Ban className="w-6 h-6" /> : <Navigation className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                            {renderPriorityBadge(req.priority)}
                            {req.status === RequestStatus.CANCELLED && <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-300">CANCELADO</span>}
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">{req.taskDescription}</h3>
                        <p className="text-sm text-slate-500 font-medium">Destino: {req.destination}</p>
                        <div className="flex flex-col gap-1 mt-2 text-xs text-slate-400">
                             <span>Criado em: {new Date(req.createdAt).toLocaleDateString()}</span>
                             <div className="flex flex-wrap gap-2">
                                {req.cc && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded font-mono font-bold flex items-center gap-1"><CreditCard className="w-3 h-3" /> C.C: {req.cc}</span>}
                                {req.cr && <span className="bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">CR: {req.cr}</span>}
                                {req.driverName && <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">Motorista: {req.driverName}</span>}
                             </div>
                        </div>
                        
                        {req.vehicleSnapshot && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit border border-indigo-100">
                                <Car className="w-3 h-3" /> <span className="font-semibold">Veículo:</span> {req.vehicleSnapshot}
                            </div>
                        )}
                        {req.finalCost && (
                            <div className="mt-2 flex items-center gap-1 text-lg text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg w-fit border border-emerald-200 shadow-sm">
                                <DollarSign className="w-5 h-5" /> <span className="font-bold">Custo Final: R$ {req.finalCost.toFixed(2)}</span>
                            </div>
                        )}
                        
                        {/* Exibir Motivo de Reinício no Histórico */}
                        {req.restartReason && (
                            <div className="mt-2 bg-amber-50 text-amber-800 p-2 rounded border border-amber-200 text-xs flex items-center gap-2">
                                <RotateCcw className="w-3 h-3" />
                                <span><span className="font-bold">Houve Reinício:</span> {req.restartReason}</span>
                            </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end">
                        {(req.status === RequestStatus.PENDING || req.status === RequestStatus.ACCEPTED || req.status === RequestStatus.IN_TRANSIT) && (
                            <button onClick={() => openCancelModal(req.id)} className="mb-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-medium border border-transparent hover:border-red-100"><XCircle className="w-3 h-3" /> Cancelar Solicitação</button>
                        )}
                        {req.attachmentUrl && <a href={req.attachmentUrl.startsWith('blob:') ? req.attachmentUrl : '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200 transition w-full md:w-auto" onClick={(e) => { if(!req.attachmentUrl?.startsWith('blob:')) { e.preventDefault(); alert('Visualização simulada'); } }}><Paperclip className="w-4 h-4" /> Meu Anexo</a>}
                        {req.driverAttachmentUrl && <a href={req.driverAttachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 border border-blue-200 transition w-full md:w-auto font-medium"><Camera className="w-4 h-4" /> Foto do Motorista</a>}
                    </div>
                  </div>

                  {req.driverNotes && (
                      <div className="mb-4 bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-start gap-3">
                          <MessageSquare className="w-4 h-4 text-slate-400 mt-1" />
                          <div>
                              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações do Motorista:</span>
                              <p className="text-sm text-slate-700">{req.driverNotes}</p>
                          </div>
                      </div>
                  )}

                  <div className="mt-4 px-2"><ProgressRuler request={req} /></div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};