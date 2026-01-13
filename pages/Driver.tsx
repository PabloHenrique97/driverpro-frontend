import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { RequestStatus, TaskRequest, TaskPriority } from '../types';
import { MapPin, Navigation, Clock, CheckCircle, AlertCircle, Play, Pause, Square, Paperclip, RefreshCw, Milestone, User, Info, CreditCard, Camera, X, Mic, StopCircle, Loader2, Search, AlertTriangle, Zap, Calendar, Ban, RotateCcw, Route, Layers, ArrowDown, ArrowUpCircle, ChevronRight, Timer, Car, DollarSign } from 'lucide-react';
import { transcribeAudio, askMapsGrounding } from '../services/geminiService';

const STATUS_PT = {
    [RequestStatus.PENDING]: 'Pendente',
    [RequestStatus.ACCEPTED]: 'Aceito',
    [RequestStatus.IN_TRANSIT]: 'Em Rota',
    [RequestStatus.EXECUTING]: 'Executando',
    [RequestStatus.COMPLETED]: 'Concluído',
    [RequestStatus.REJECTED]: 'Recusado',
    [RequestStatus.CANCELLED]: 'Cancelado',
};

// Haversine formula to calculate distance in KM between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Number(d.toFixed(2));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

const TimerDisplay = ({ seconds, label }: { seconds: number; label: string }) => {
  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800 text-white p-4 rounded-lg text-center flex flex-col items-center min-w-[120px]">
      <span className="text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</span>
      <span className="text-3xl font-mono font-bold">{formatTime(seconds)}</span>
    </div>
  );
};

export const DriverDashboard = () => {
  const { currentUser, requests, vehicles, updateRequestStatus, refreshData, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('active');
  
  // Timer & Form State
  const [activeRequest, setActiveRequest] = useState<TaskRequest | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [observation, setObservation] = useState('');
  const [currentLocationInput, setCurrentLocationInput] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Route Optimization State
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [nextStopModal, setNextStopModal] = useState<{ finishedTask: TaskRequest, nextTask: TaskRequest } | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>(''); // Store detected mime type

  // Maps Grounding State
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsAnswer, setMapsAnswer] = useState('');
  const [isAskingMaps, setIsAskingMaps] = useState(false);
  const [showMapsAssistant, setShowMapsAssistant] = useState(false);

  // Restart Logic State
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [restartReason, setRestartReason] = useState('');

  // Rejection Logic State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Camera State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driverPhoto, setDriverPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Find active request on load
  useEffect(() => {
    const current = requests.find(r => 
      r.driverId === currentUser?.id && 
      (r.status === RequestStatus.IN_TRANSIT || r.status === RequestStatus.EXECUTING)
    );
    setActiveRequest(current);
    
    // Set default vehicle if exists and not already set
    if (currentUser?.defaultVehicleId) {
        setSelectedVehicleId(currentUser.defaultVehicleId);
    }
    // If request has vehicle already, override
    if (current?.vehicleId) {
        setSelectedVehicleId(current.vehicleId);
    }

  }, [requests, currentUser]);

  // Timer Interval
  useEffect(() => {
    let interval: number;
    if (activeRequest) {
      // Initialize elapsed based on stored duration + current session
      const isTravel = activeRequest.status === RequestStatus.IN_TRANSIT;
      const isWork = activeRequest.status === RequestStatus.EXECUTING;
      
      const startTime = isTravel ? activeRequest.travelStartAt : activeRequest.workStartAt;
      const baseDuration = isTravel ? activeRequest.travelDuration : activeRequest.workDuration;

      if ((isTravel || isWork) && startTime) {
         interval = window.setInterval(() => {
           const now = Date.now();
           const sessionSeconds = Math.floor((now - startTime) / 1000);
           setElapsed(baseDuration + sessionSeconds);
         }, 1000);
      }
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeRequest]);

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalização não suportada."));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }
    });
  };

  const handleStartRoute = async (req: TaskRequest, autoStartLocation?: string) => {
    let startLoc = autoStartLocation || currentLocationInput;

    if (!startLoc && !currentLocationInput.trim()) {
       if (!confirm("Iniciar percurso usando sua localização GPS atual?")) {
           return;
       }
    }

    // Vehicle Check
    let vehicleInfo = {};
    if (selectedVehicleId) {
        const v = vehicles.find(veh => veh.id === selectedVehicleId);
        if (v) {
            vehicleInfo = {
                vehicleId: v.id,
                vehicleSnapshot: v.tag ? `TAG: ${v.tag}` : `${v.model} (${v.plate})`
            };
        }
    }

    setIsGettingLocation(true);
    try {
        const position = await getPosition();
        
        updateRequestStatus(req.id, RequestStatus.IN_TRANSIT, { 
            travelStartAt: Date.now(),
            driverStartLocation: startLoc || "GPS",
            startLat: position.coords.latitude,
            startLng: position.coords.longitude,
            ...vehicleInfo
        });
        setCurrentLocationInput('');
    } catch (error) {
        console.error(error);
        alert("Erro ao obter localização GPS. Iniciando rota com localização estimada.");
        updateRequestStatus(req.id, RequestStatus.IN_TRANSIT, { 
            travelStartAt: Date.now(),
            driverStartLocation: startLoc || "Manual",
            ...vehicleInfo
        });
    } finally {
        setIsGettingLocation(false);
    }
  };

  const handleAccept = (reqId: string) => {
    // If user has default vehicle, save it now
    let vehicleUpdates = {};
    if (currentUser?.defaultVehicleId) {
         const v = vehicles.find(veh => veh.id === currentUser.defaultVehicleId);
         if (v) {
             vehicleUpdates = { 
                 vehicleId: v.id, 
                 vehicleSnapshot: v.tag ? `TAG: ${v.tag}` : `${v.model} (${v.plate})`
             };
         }
    }
    updateRequestStatus(reqId, RequestStatus.ACCEPTED, { acceptedAt: Date.now(), ...vehicleUpdates });
  };

  const openRejectModal = (reqId: string) => {
      setRequestToReject(reqId);
      setRejectReason('');
      setRejectModalOpen(true);
  };

  const confirmReject = () => {
    if (!requestToReject || !rejectReason.trim()) return;
    updateRequestStatus(requestToReject, RequestStatus.REJECTED, {
        rejectionReason: rejectReason
    });
    setRejectModalOpen(false);
    setRequestToReject(null);
    setRejectReason('');
  };

  // Route Optimization Logic
  const toggleSelection = (reqId: string) => {
      setSelectedRequestIds(prev => 
          prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]
      );
  };

  // Move a specific request to the start of the queue (index 0)
  const setAsFirstStop = (reqId: string) => {
      setSelectedRequestIds(prev => {
          const others = prev.filter(id => id !== reqId);
          return [reqId, ...others];
      });
  };

  const handleCreateSmartRoute = () => {
      if (selectedRequestIds.length === 0) return;
      selectedRequestIds.forEach(id => {
          handleAccept(id);
      });
      setSelectedRequestIds([]);
      setActiveTab('active');
      alert(`Rota criada com ${selectedRequestIds.length} paradas!`);
  };

  const handleArrived = async () => {
    if (!activeRequest) return;
    
    setIsGettingLocation(true);

    try {
        let calculatedDistance = 0;
        const position = await getPosition();
        const endLat = position.coords.latitude;
        const endLng = position.coords.longitude;

        if (activeRequest.startLat && activeRequest.startLng) {
            calculatedDistance = calculateDistance(
                activeRequest.startLat,
                activeRequest.startLng,
                endLat,
                endLng
            );
        }

        const travelEnd = Date.now();
        const sessionDuration = Math.floor((travelEnd - (activeRequest.travelStartAt || travelEnd)) / 1000);
        const totalTravel = activeRequest.travelDuration + sessionDuration;

        updateRequestStatus(activeRequest.id, RequestStatus.EXECUTING, { 
            travelDuration: totalTravel,
            workStartAt: Date.now(),
            tripDistanceKm: calculatedDistance
        });
        
        setElapsed(0); 
        if (calculatedDistance > 0) {
            alert(`Distância calculada via GPS: ${calculatedDistance} KM`);
        }

    } catch (error) {
        console.error(error);
        const travelEnd = Date.now();
        const sessionDuration = Math.floor((travelEnd - (activeRequest.travelStartAt || travelEnd)) / 1000);
        updateRequestStatus(activeRequest.id, RequestStatus.EXECUTING, { 
            travelDuration: activeRequest.travelDuration + sessionDuration,
            workStartAt: Date.now(),
            tripDistanceKm: 0
        });
        setElapsed(0);
    } finally {
        setIsGettingLocation(false);
    }
  };

  const handleRestartTask = () => {
      if (!activeRequest || !restartReason.trim()) return;

      updateRequestStatus(activeRequest.id, RequestStatus.ACCEPTED, {
          restartReason: restartReason,
          travelStartAt: undefined,
          workStartAt: undefined,
          driverStartLocation: undefined,
          tripDistanceKm: undefined,
          travelDuration: 0,
          workDuration: 0
      });

      setRestartModalOpen(false);
      setRestartReason('');
      setElapsed(0);
  };

  // --- Audio Recording Logic Fixed ---
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/aac'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; 
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Seu navegador não suporta gravação de áudio.");
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getSupportedMimeType();
        mimeTypeRef.current = mimeType;
        const options = mimeType ? { mimeType } : undefined;
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorder.onstop = async () => {
            const type = mediaRecorder.mimeType || mimeTypeRef.current || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type });
            stream.getTracks().forEach(track => track.stop()); 
            await processAudio(audioBlob, type);
        };
        mediaRecorder.start();
        setIsRecording(true);
    } catch (err: any) {
        console.error("Erro no Microfone:", err);
        alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
      setIsTranscribing(true);
      try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              if (base64Audio) {
                const text = await transcribeAudio(base64Audio, mimeType);
                if (text) setObservation(prev => (prev ? prev + "\n" + text : text));
                else alert("Transcrição vazia.");
              }
              setIsTranscribing(false);
          };
      } catch (error) {
          console.error(error);
          setIsTranscribing(false);
      }
  };

  // --- Maps Grounding ---
  const handleAskMaps = async () => {
      if (!mapsQuery.trim()) return;
      setIsAskingMaps(true);
      setMapsAnswer('');
      try {
          let loc = undefined;
          try {
             const pos = await getPosition();
             loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          } catch(e) {}
          const answer = await askMapsGrounding(mapsQuery, loc);
          setMapsAnswer(answer);
      } catch(e) {
          setMapsAnswer("Erro ao consultar serviço de mapas.");
      } finally {
          setIsAskingMaps(false);
      }
  };

  // Camera
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDriverPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearPhoto = () => {
    setDriverPhoto(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const myRequests = requests.filter(r => r.driverId === currentUser?.id);
  const assignedPending = myRequests.filter(r => r.status === RequestStatus.ACCEPTED || r.status === RequestStatus.PENDING);
  // Important: acceptedTasks for next stops logic
  const acceptedTasks = myRequests.filter(r => r.status === RequestStatus.ACCEPTED && r.id !== activeRequest?.id);
  const completedHistory = myRequests.filter(r => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.REJECTED || r.status === RequestStatus.CANCELLED);

  const handleFinishTask = () => {
    if (!activeRequest) return;
    const workEnd = Date.now();
    const sessionDuration = Math.floor((workEnd - (activeRequest.workStartAt || workEnd)) / 1000);
    const totalWork = activeRequest.workDuration + sessionDuration;
    const attachmentUrl = driverPhoto ? URL.createObjectURL(driverPhoto) : undefined;
    
    // Update vehicle info if changed during execution
    let vehicleInfo = {};
    if (selectedVehicleId) {
         const v = vehicles.find(veh => veh.id === selectedVehicleId);
         if (v) {
             vehicleInfo = {
                 vehicleId: v.id,
                 vehicleSnapshot: v.tag ? `TAG: ${v.tag}` : `${v.model} (${v.plate})`
             };
         }
    }

    // 1. Identifica se existe uma próxima tarefa NA FILA (Accepted)
    const nextTask = acceptedTasks.length > 0 ? acceptedTasks[0] : null;

    // 2. Atualiza a tarefa atual para COMPLETED
    updateRequestStatus(activeRequest.id, RequestStatus.COMPLETED, {
      workDuration: totalWork,
      completedAt: workEnd,
      driverNotes: observation,
      driverAttachmentUrl: attachmentUrl,
      ...vehicleInfo
    });

    // 3. Se houver próxima tarefa, abre o modal para iniciar o timer da próxima IMEDIATAMENTE
    if (nextTask) {
        setNextStopModal({
            finishedTask: activeRequest,
            nextTask: nextTask
        });
    }

    setObservation('');
    clearPhoto();
  };

  // Lógica para iniciar a próxima tarefa a partir do Modal
  const confirmStartNextRoute = () => {
      if (nextStopModal) {
          // Lógica AUTOMÁTICA: O destino da tarefa que acabou vira a origem da próxima
          const previousDestination = nextStopModal.finishedTask.destination;
          
          handleStartRoute(nextStopModal.nextTask, previousDestination);
          setNextStopModal(null); // Fecha o modal
      }
  };

  // Helper for Route Name Display
  const getNextDestinationName = () => {
      if (selectedRequestIds.length === 0) return '';
      const firstId = selectedRequestIds[0];
      const req = requests.find(r => r.id === firstId);
      return req ? req.destination : '';
  };

  // Helper to render priority badge
  const renderPriorityBadge = (priority?: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> URGENTE - Resolver Agora
          </span>
        );
      case TaskPriority.IMPORTANT:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">
            <Zap className="w-3 h-3" /> IMPORTANTE - Resolver Hoje
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

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 relative">
      
      {/* NEXT STOP TRANSITION MODAL */}
      {nextStopModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/90 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="bg-green-500 p-6 text-center text-white">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                          <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold">Tarefa Finalizada!</h2>
                      <p className="text-green-100 text-sm mt-1">{nextStopModal.finishedTask.destination}</p>
                  </div>
                  
                  <div className="p-6">
                      <div className="text-center mb-6">
                          <p className="text-slate-500 text-sm uppercase font-bold tracking-wide mb-2">Próxima Parada (Fila)</p>
                          <h3 className="text-xl font-bold text-slate-800">{nextStopModal.nextTask.destination}</h3>
                          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-slate-600">
                              <span className="bg-slate-100 px-2 py-1 rounded">{nextStopModal.nextTask.taskDescription}</span>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <button 
                              onClick={confirmStartNextRoute}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 group"
                          >
                              <Navigation className="w-5 h-5 group-hover:translate-x-1 transition" />
                              Iniciar Deslocamento Agora
                          </button>
                          
                          <button 
                              onClick={() => setNextStopModal(null)}
                              className="w-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium py-3 rounded-xl transition mt-2"
                          >
                              Pausar / Voltar ao Painel
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RESTART MODAL */}
      {restartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center gap-3 text-amber-600 mb-4 border-b border-amber-100 pb-3">
                      <RotateCcw className="w-6 h-6" />
                      <h3 className="text-lg font-bold">Reiniciar Atendimento</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                      Você vai <strong>zerar o andamento</strong> desta tarefa e ela voltará para a lista de tarefas aceitas.
                  </p>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Motivo do Reinício <span className="text-red-500">*</span></label>
                  <textarea 
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none mb-6"
                      rows={3}
                      value={restartReason}
                      onChange={e => setRestartReason(e.target.value)}
                  />
                  <div className="flex gap-3 justify-end">
                      <button onClick={() => setRestartModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Voltar</button>
                      <button onClick={handleRestartTask} disabled={!restartReason.trim()} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-lg transition disabled:opacity-50">Confirmar Reinício</button>
                  </div>
              </div>
          </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center gap-3 text-red-600 mb-4 border-b border-red-100 pb-3">
                      <AlertCircle className="w-6 h-6" />
                      <h3 className="text-lg font-bold">Recusar Solicitação</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                      O solicitante será notificado de que você não pode atender esta demanda no momento.
                  </p>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Motivo da Recusa <span className="text-red-500">*</span></label>
                  <textarea 
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-6"
                      rows={3}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-3 justify-end">
                      <button onClick={() => setRejectModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancelar</button>
                      <button onClick={confirmReject} disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg transition disabled:opacity-50">Confirmar Recusa</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-6 flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Painel do Motorista</h1>
            <p className="text-slate-500">Bem-vindo, {currentUser?.name}</p>
        </div>
        <button 
            onClick={refreshData}
            className={`p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm flex items-center gap-2 ${isLoading ? 'opacity-50' : ''}`}
            disabled={isLoading}
        >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {/* ACTIVE TASK OVERLAY */}
      {activeRequest && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 mb-8 sticky top-4 z-10">
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <Navigation className="w-5 h-5 animate-pulse" /> Em Andamento
            </h2>
            <span className="text-xs bg-white text-blue-600 px-2 py-1 rounded font-bold uppercase">
               {activeRequest.status === RequestStatus.IN_TRANSIT ? 'Em Rota' : 'Executando Tarefa'}
            </span>
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-6">
               <div className="flex-1 w-full">
                 <div className="flex justify-between items-start">
                     <div>
                        <div className="mb-2">{renderPriorityBadge(activeRequest.priority)}</div>
                        <div className="text-sm text-slate-500 mb-1">Destino</div>
                        <div className="text-xl font-semibold text-slate-800 truncate">{activeRequest.destination}</div>
                     </div>
                 </div>

                 <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                     <p className="text-slate-800 font-medium"><span className="text-xs font-bold text-slate-500 uppercase">Solicitante:</span> {activeRequest.solicitorName}</p>
                     <p className="text-slate-700 mt-2"><span className="text-xs font-bold text-slate-500 uppercase">Tarefa:</span> {activeRequest.taskDescription}</p>
                 </div>

                 {/* Vehicle Selector during execution */}
                 <div className="mt-4">
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Car className="w-3 h-3"/> Veículo Utilizado</label>
                     <select 
                        className="w-full border p-2 rounded text-sm bg-white font-mono"
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                     >
                         <option value="">Selecione um veículo...</option>
                         {vehicles.map(v => (
                             <option key={v.id} value={v.id}>
                                {v.tag ? `TAG: ${v.tag} (${v.model})` : `${v.model} (${v.plate})`}
                             </option>
                         ))}
                     </select>
                 </div>

                 {activeRequest.notes && (
                     <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-slate-700 italic">
                        <span className="font-bold not-italic text-yellow-700 block mb-1">Obs. Solicitante:</span> "{activeRequest.notes}"
                     </div>
                 )}
               </div>
               
               <TimerDisplay seconds={elapsed} label={activeRequest.status === RequestStatus.IN_TRANSIT ? "Tempo de Percurso" : "Tempo de Tarefa"} />
            </div>

            {/* AI Maps Assistant */}
            <div className="mb-4">
                <button onClick={() => setShowMapsAssistant(!showMapsAssistant)} className="text-sm text-blue-600 flex items-center gap-1 hover:underline font-medium">
                  <Search className="w-4 h-4" /> {showMapsAssistant ? 'Ocultar Assistente' : 'Ajuda com a rota (IA)?'}
                </button>
                {showMapsAssistant && (
                  <div className="mt-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex gap-2">
                      <input type="text" className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Ex: Como está o trânsito?" value={mapsQuery} onChange={e => setMapsQuery(e.target.value)} />
                      <button onClick={handleAskMaps} disabled={isAskingMaps} className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold">
                        {isAskingMaps ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Perguntar'}
                      </button>
                    </div>
                    {mapsAnswer && <div className="mt-2 p-2 bg-white rounded border border-blue-100 text-sm text-slate-700">{mapsAnswer}</div>}
                  </div>
                )}
            </div>

            <div className="space-y-4">
              {activeRequest.status === RequestStatus.IN_TRANSIT ? (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <button onClick={handleArrived} disabled={isGettingLocation} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold px-6 py-4 rounded-lg shadow-lg transition flex justify-center items-center gap-2 text-lg">
                        {isGettingLocation ? <RefreshCw className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />} Cheguei no Local
                    </button>
                    <button onClick={() => setRestartModalOpen(true)} className="w-full mt-3 text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Reiniciar Atendimento
                    </button>
                </div>
              ) : (
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Finalização</h3>
                  
                  {/* Photo Capture */}
                  <div>
                    <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
                    {!previewUrl ? (
                      <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-500 py-4 rounded-lg flex flex-col items-center justify-center gap-2 transition">
                        <Camera className="w-8 h-8 text-slate-400" /> <span className="text-sm font-medium">Tirar Foto / Anexar Comprovante</span>
                      </button>
                    ) : (
                      <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden group">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                        <button onClick={clearPhoto} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"><X className="w-5 h-5" /></button>
                      </div>
                    )}
                  </div>

                  {/* Observations */}
                  <div className="relative">
                    <textarea placeholder="Observações (Visível para o solicitante)..." className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-12" value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} />
                    <div className="absolute right-2 bottom-2">
                        {isRecording ? (
                            <button onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 animate-pulse transition"><StopCircle className="w-4 h-4" /></button>
                        ) : (
                            <button onClick={startRecording} disabled={isTranscribing} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-blue-100 hover:text-blue-600 transition disabled:opacity-50">
                                {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mic className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                       <button onClick={() => setRestartModalOpen(true)} className="flex-1 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold py-4 rounded-xl shadow-sm transition flex justify-center items-center gap-2">
                        <RotateCcw className="w-5 h-5" /> Reiniciar
                      </button>
                      <button onClick={handleFinishTask} className="flex-[2] bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2">
                        <CheckCircle className="w-6 h-6" /> Finalizar Tarefa
                      </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 font-medium transition ${activeTab === 'active' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Novas / Pendentes</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 font-medium transition ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Histórico</button>
      </div>

      <div className="space-y-4">
        {activeTab === 'active' && assignedPending.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma tarefa pendente.</div>}
        
        {/* OPTIMIZATION ACTION BAR */}
        {activeTab === 'active' && selectedRequestIds.length > 0 && (
            <div className="sticky top-0 z-20 bg-indigo-600 text-white p-4 rounded-xl shadow-lg mb-6 animate-in slide-in-from-top-2">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500 p-2 rounded-lg"><Route className="w-6 h-6" /></div>
                        <div>
                            <h3 className="font-bold text-sm">Rota Inteligente ({selectedRequestIds.length})</h3>
                            <div className="text-xs text-indigo-100 flex items-center gap-1 mt-0.5">
                                <span>Próximo:</span>
                                <span className="font-bold bg-white text-indigo-700 px-1.5 rounded-full shadow-sm max-w-[150px] truncate block">{getNextDestinationName()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleCreateSmartRoute} className="w-full sm:w-auto bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-50 transition shadow-md flex items-center justify-center gap-2">
                        Criar & Iniciar <ArrowDown className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'active' && assignedPending.map(req => {
          const selectionIndex = selectedRequestIds.indexOf(req.id);
          const isSelected = selectionIndex !== -1;
          const isFirstStop = selectionIndex === 0;

          return (
          <div key={req.id} className={`p-5 rounded-lg shadow border transition relative ${isSelected ? (isFirstStop ? 'bg-green-50 border-green-300 ring-2 ring-green-400' : 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300') : 'bg-white border-slate-100'}`}>
            
            {req.status === RequestStatus.PENDING && (
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <button onClick={() => toggleSelection(req.id)} className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition shadow-sm ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 hover:border-slate-400'}`}>
                        {isSelected && <span className="text-white font-bold text-sm">{selectionIndex + 1}</span>}
                    </button>
                    {isSelected && !isFirstStop && (
                        <button onClick={(e) => { e.stopPropagation(); setAsFirstStop(req.id); }} className="text-xs bg-white text-indigo-600 border border-indigo-200 px-2 py-1 rounded-md shadow-sm hover:bg-indigo-50 flex items-center gap-1 font-medium transition">
                            <ArrowUpCircle className="w-3 h-3" /> Começar
                        </button>
                    )}
                </div>
            )}
            
            {isFirstStop && req.status === RequestStatus.PENDING && (
                 <div className="absolute -top-3 left-4 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md z-10 flex items-center gap-1">
                     <Play className="w-3 h-3 fill-current" /> PRÓXIMO DESTINO
                 </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded font-bold ${req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {STATUS_PT[req.status]}
                </span>
                <span className="text-slate-400 text-xs">#{req.id}</span>
                {renderPriorityBadge(req.priority)}
              </div>
              <h3 className="font-bold text-lg text-slate-800 pr-12">{req.taskDescription}</h3>
              <div className="mt-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-500 text-xs uppercase">Solicitante:</span> {req.solicitorName}
              </div>
              {req.cc && <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700 font-bold"><CreditCard className="w-3 h-3" /> C.C: {req.cc}</div>}
              {req.notes && <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100"><span className="font-bold text-xs uppercase text-slate-400 block mb-1">Obs. Solicitante:</span> {req.notes}</div>}
              <div className="text-sm text-slate-500 mt-2 flex flex-col gap-1"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Para: {req.destination}</span></div>
              {req.attachmentUrl && (
                <div className="mt-2"><a href={req.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-slate-50 hover:bg-slate-100 inline-flex items-center gap-1 px-2 py-1 rounded text-slate-600 border border-slate-200 transition"><Paperclip className="w-3 h-3" /> Ver Anexo</a></div>
              )}
            </div>
            <div className="flex items-center w-full sm:w-auto mt-4 sm:mt-0">
              {req.status === RequestStatus.ACCEPTED ? (
                 <div className="w-full">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização Atual</label>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Onde você está?" value={currentLocationInput} onChange={(e) => setCurrentLocationInput(e.target.value)} />
                        <button onClick={() => handleStartRoute(req)} disabled={!!activeRequest || isGettingLocation} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded font-bold flex items-center justify-center gap-2 transition whitespace-nowrap">
                            {isGettingLocation ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Navigation className="w-4 h-4" />} Iniciar
                        </button>
                    </div>
                    {/* Vehicle Pre-select or change */}
                     <div className="mt-2">
                         <select 
                             className="w-full border p-1 text-xs rounded font-mono" 
                             value={selectedVehicleId} 
                             onChange={(e) => setSelectedVehicleId(e.target.value)}
                         >
                             <option value="">Veículo: {currentUser?.defaultVehicleId ? 'Padrão' : 'Selecionar'}</option>
                             {vehicles.map(v => (
                                 <option key={v.id} value={v.id}>
                                     {v.tag ? `TAG: ${v.tag} (${v.model})` : `${v.model} (${v.plate})`}
                                 </option>
                             ))}
                         </select>
                     </div>
                 </div>
              ) : req.status === RequestStatus.PENDING ? (
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => openRejectModal(req.id)} className="flex-1 sm:flex-none px-4 py-2 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 transition">Recusar</button>
                    <button onClick={() => handleAccept(req.id)} className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-md">Aceitar</button>
                </div>
              ) : (
                <button className="w-full sm:w-auto bg-slate-100 text-slate-500 px-6 py-3 rounded-lg font-bold cursor-not-allowed" disabled>Aguardando</button>
              )}
            </div>
          </div>
          </div>
          );
        })}

        {activeTab === 'history' && completedHistory.map(req => (
           <div key={req.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 hover:bg-white transition">
              <div className="flex justify-between items-start">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                     <h4 className="font-semibold text-slate-700">{req.taskDescription}</h4>
                     {req.status === RequestStatus.REJECTED && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded border border-red-200">RECUSADO</span>}
                     {req.status === RequestStatus.COMPLETED && <span className="text-[10px] bg-green-100 text-green-600 px-1 rounded border border-green-200">CONCLUÍDO</span>}
                     {req.status === RequestStatus.CANCELLED && <span className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded border border-slate-300">CANCELADO</span>}
                   </div>
                   <div className="text-sm text-slate-500">
                        <div>De: {req.driverStartLocation || 'N/A'}</div>
                        <div>Para: {req.destination}</div>
                   </div>
                   {req.driverNotes && <div className="mt-2 text-xs text-slate-600 bg-white p-2 border border-slate-200 rounded"><span className="font-bold">Minhas Observações:</span> {req.driverNotes}</div>}
                   {req.rejectionReason && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 border border-red-100 rounded"><span className="font-bold">Motivo da Recusa:</span> {req.rejectionReason}</div>}
                   {req.vehicleSnapshot && <div className="mt-2 text-xs text-indigo-600 flex items-center gap-1"><Car className="w-3 h-3" /> Veículo: {req.vehicleSnapshot}</div>}
                   <p className="text-xs text-slate-400 mt-2">{req.status === RequestStatus.COMPLETED ? `Finalizado em ${new Date(req.completedAt || Date.now()).toLocaleDateString()}` : ''}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="font-bold text-slate-700">{req.tripDistanceKm ? `${req.tripDistanceKm} KM` : '- KM'}</div>
                  <div>🚗 {Math.floor(req.travelDuration / 60)} min</div>
                  <div>🔨 {Math.floor(req.workDuration / 60)} min</div>
                  {req.finalCost && (
                    <div className="mt-2 text-lg text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shadow-sm font-bold flex items-center gap-1 justify-end">
                       <DollarSign className="w-4 h-4" /> {req.finalCost.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
           </div>
        ))}
      </div>
    </div>
  );
};