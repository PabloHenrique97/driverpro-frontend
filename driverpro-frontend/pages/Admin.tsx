import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../store';
import { UserRole, RequestStatus, User, TaskPriority, Vehicle, TaskRequest } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { Users, UserPlus, TrendingUp, Clock, Calendar, Sparkles, Pencil, Trash2, X, Lock, Filter, Search, ShieldAlert, Shield, Truck, Timer, FileSpreadsheet, FileText, Download, RefreshCw, MapPin, Milestone, Building, CreditCard, AlertTriangle, Zap, Ban, Hourglass, Video, Play, Key, Car, DollarSign, Printer, ClipboardList, Activity, Clapperboard } from 'lucide-react';
import { generateProductivityInsight, generatePromoVideo } from '../services/geminiService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PRIORITY_COLORS = {
  [TaskPriority.URGENT]: '#ef4444',   // Red
  [TaskPriority.IMPORTANT]: '#f59e0b', // Amber
  [TaskPriority.NORMAL]: '#3b82f6'    // Blue
};

const STATUS_PT = {
    [RequestStatus.PENDING]: 'Pendente',
    [RequestStatus.ACCEPTED]: 'Aceito',
    [RequestStatus.IN_TRANSIT]: 'Em Rota',
    [RequestStatus.EXECUTING]: 'Executando',
    [RequestStatus.COMPLETED]: 'Concluído',
    [RequestStatus.REJECTED]: 'Recusado',
    [RequestStatus.CANCELLED]: 'Cancelado',
};

// Props interface for navigation control
interface AdminDashboardProps {
    view: 'dashboard' | 'users' | 'vehicles' | 'marketing' | 'reports';
}

export const AdminDashboard = ({ view }: AdminDashboardProps) => {
  const { users, requests, vehicles, addUser, editUser, deleteUser, addVehicle, editVehicle, deleteVehicle, refreshData, isLoading } = useApp();
  
  // Local state for Insight and Marketing
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  
  // Reports Tab State
  const [reportTab, setReportTab] = useState<'users' | 'vehicles' | 'costs'>('users');

  // Marketing Video State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("Vídeo cinematográfico comercial mostrando o aplicativo 'DriverPro' em ação. Cenas divididas: 1. Um gestor em um escritório moderno olhando para um monitor com gráficos de produtividade e mapas de rastreamento. 2. Corte para um motorista feliz em uma caminhonete Fiat Strada, usando o smartphone para aceitar uma rota. 3. O motorista tirando uma foto de uma entrega concluída. Estilo: Corporativo, tecnológico, alta resolução, iluminação profissional, cores azul e branco.");
  
  // Filter State
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDriverId, setFilterDriverId] = useState<string>('ALL');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  // Forms States
  const initialUserForm = { id: '', name: '', email: '', cpf: '', password: '', role: UserRole.DRIVER, cr: '', defaultVehicleId: '' };
  const [userFormData, setUserFormData] = useState(initialUserForm);
  const [isEditingUser, setIsEditingUser] = useState(false);

  const initialVehicleForm = { id: '', model: '', plate: '', tag: '', hourlyRate: 0 };
  const [vehicleFormData, setVehicleFormData] = useState(initialVehicleForm);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  // Check API Key on mount
  useEffect(() => {
    const checkKey = async () => {
        const win = window as any;
        if (win.aistudio && win.aistudio.hasSelectedApiKey) {
            const has = await win.aistudio.hasSelectedApiKey();
            setHasApiKey(has);
        }
    };
    checkKey();
  }, []);

  const handleSelectApiKey = async () => {
      const win = window as any;
      if (win.aistudio && win.aistudio.openSelectKey) {
          await win.aistudio.openSelectKey();
          const has = await win.aistudio.hasSelectedApiKey();
          setHasApiKey(has);
      } else {
          alert("Seletor de chave API não disponível neste ambiente.");
      }
  };

  // Get list of drivers for filter
  const driversList = useMemo(() => users.filter(u => u.role === UserRole.DRIVER), [users]);

  // 1. First, filter requests based on Date Range
  const requestsByDate = useMemo(() => {
    return requests.filter(req => {
        const reqDate = new Date(req.createdAt);
        
        // Filter Start Date
        if (dateStart) {
            const start = new Date(dateStart);
            start.setHours(0, 0, 0, 0); 
            if (reqDate < start) return false;
        }

        // Filter End Date
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            if (reqDate > end) return false;
        }

        return true;
    });
  }, [requests, dateStart, dateEnd]);

  // 2. Calculate Stats based on Date Filtered Data
  const stats = useMemo(() => {
    const sourceData = requestsByDate; // Use filtered data
    const completed = sourceData.filter(r => r.status === RequestStatus.COMPLETED);
    const totalTrips = sourceData.filter(r => r.travelStartAt).length; // Trips initiated in this period
    
    // Averages
    const totalTravelTime = completed.reduce((acc, curr) => acc + curr.travelDuration, 0);
    const totalTaskTime = completed.reduce((acc, curr) => acc + curr.workDuration, 0);
    const totalCost = completed.reduce((acc, curr) => acc + (curr.finalCost || 0), 0);
    
    // --- Chart Data Preparation ---

    // 1. Priority Distribution (Pie)
    const priorityCounts = {
        [TaskPriority.URGENT]: 0,
        [TaskPriority.IMPORTANT]: 0,
        [TaskPriority.NORMAL]: 0
    };
    sourceData.forEach(r => {
        const p = r.priority || TaskPriority.NORMAL;
        priorityCounts[p]++;
    });
    const priorityData = [
        { name: 'Urgente', value: priorityCounts[TaskPriority.URGENT] },
        { name: 'Importante', value: priorityCounts[TaskPriority.IMPORTANT] },
        { name: 'Normal', value: priorityCounts[TaskPriority.NORMAL] }
    ].filter(d => d.value > 0);

    // 2. Average Service Time per Driver (Bar)
    const driverTimeMap = new Map<string, { totalTime: number, count: number }>();
    completed.forEach(r => {
        if (!r.driverName) return;
        const current = driverTimeMap.get(r.driverName) || { totalTime: 0, count: 0 };
        driverTimeMap.set(r.driverName, {
            totalTime: current.totalTime + r.workDuration,
            count: current.count + 1
        });
    });
    const avgTimePerDriver = Array.from(driverTimeMap.entries()).map(([name, data]) => ({
        name,
        avgMinutes: Math.round((data.totalTime / data.count) / 60),
        tasksCompleted: data.count
    })).sort((a, b) => b.avgMinutes - a.avgMinutes);

    // 3. Daily Cost Trend (Area Chart) - AI Indicator Suggestion 1
    const costMap = new Map<string, number>();
    completed.forEach(r => {
        const day = new Date(r.createdAt).toLocaleDateString();
        costMap.set(day, (costMap.get(day) || 0) + (r.finalCost || 0));
    });
    const dailyCostTrend = Array.from(costMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Operational Efficiency Index (Simulated AI metric)
    const efficiencyData = avgTimePerDriver.map(d => ({
        name: d.name,
        efficiencyScore: Math.round(Math.random() * (95 - 75) + 75), // Simulated score 75-95
        tasks: d.tasksCompleted
    }));


    // 5. Cost by Vehicle (Bar Chart) - New Indicator
    const vehicleCostMap = new Map<string, number>();
    completed.forEach(r => {
        const vKey = r.vehicleSnapshot || 'Indefinido';
        vehicleCostMap.set(vKey, (vehicleCostMap.get(vKey) || 0) + (r.finalCost || 0));
    });
    const costByVehicle = Array.from(vehicleCostMap.entries())
        .map(([name, value]) => ({ name: name.split('(')[0], value: Number(value.toFixed(2)) })) // Simplify name
        .sort((a,b) => b.value - a.value);


    // 6. Top 7 Destinations by Task Duration (Longest Tasks)
    const destDurationMap = new Map<string, { totalDuration: number, count: number }>();
    completed.forEach(r => {
        const current = destDurationMap.get(r.destination) || { totalDuration: 0, count: 0 };
        destDurationMap.set(r.destination, {
            totalDuration: current.totalDuration + r.workDuration,
            count: current.count + 1
        });
    });
    const longestDestinations = Array.from(destDurationMap.entries())
        .map(([name, data]) => ({
            name,
            avgDurationMin: Math.round((data.totalDuration / data.count) / 60)
        }))
        .sort((a, b) => b.avgDurationMin - a.avgDurationMin)
        .slice(0, 7);

    return {
      avgTravelTime: completed.length ? totalTravelTime / completed.length : 0,
      avgTaskTime: completed.length ? totalTaskTime / completed.length : 0,
      totalTripsPeriod: totalTrips,
      totalTasksPeriod: completed.length,
      totalCostPeriod: totalCost,
      priorityData,
      avgTimePerDriver,
      dailyCostTrend,
      efficiencyData,
      longestDestinations,
      costByVehicle
    };
  }, [requestsByDate]);

  // 3. Filter for Table Display (Date + Status + Driver)
  const filteredRequests = useMemo(() => {
    let filtered = requestsByDate;
    
    if (filterStatus !== 'ALL') {
        filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (filterDriverId !== 'ALL') {
        filtered = filtered.filter(r => r.driverId === filterDriverId);
    }

    return filtered;
  }, [requestsByDate, filterStatus, filterDriverId]);

  // -- Cost by CC Report Logic --
  const costsByCC = useMemo(() => {
     // Filter only completed requests with cost
     const validData = requests.filter(r => r.status === RequestStatus.COMPLETED && r.finalCost !== undefined);
     
     // Group by CC
     const grouped: Record<string, { total: number, items: typeof validData }> = {};
     
     validData.forEach(item => {
         const ccKey = item.cc || 'Sem Centro de Custo';
         if (!grouped[ccKey]) {
             grouped[ccKey] = { total: 0, items: [] };
         }
         grouped[ccKey].total += (item.finalCost || 0);
         grouped[ccKey].items.push(item);
     });

     return grouped;
  }, [requests]);


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

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.DRIVER: return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Motorista</span>;
          case UserRole.ADMIN: return <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">Admin</span>;
          case UserRole.SOLICITOR: return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Solicitante</span>;
          case UserRole.SOLICITOR_ADMIN: return <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Solicitante + Admin</span>;
          default: return null;
      }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '-';
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  // Helper to get vehicle details
  const getVehicleDetails = (vehicleId?: string) => {
      if (!vehicleId) return { model: '-', tag: '-', plate: '-' };
      const v = vehicles.find(veh => veh.id === vehicleId);
      return v ? { model: v.model, tag: v.tag || '-', plate: v.plate } : { model: 'Desconhecido', tag: '-', plate: '-' };
  };

  // --- User Handlers ---
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userData = { ...userFormData };

    if (isEditingUser && userFormData.id) {
        editUser(userFormData.id, userData);
        alert("Usuário atualizado com sucesso!");
    } else {
        addUser({ ...userData, id: '' });
        alert("Usuário cadastrado com sucesso!");
    }
    
    setUserFormData(initialUserForm);
    setIsEditingUser(false);
  };

  const handleEditUserClick = (user: User) => {
      setUserFormData({
          id: user.id,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          password: user.password || '',
          role: user.role,
          cr: user.cr || '',
          defaultVehicleId: user.defaultVehicleId || ''
      });
      setIsEditingUser(true);
  };

  const handleDeleteUserClick = (id: string) => {
      if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
          deleteUser(id);
          if (isEditingUser && userFormData.id === id) {
              setUserFormData(initialUserForm);
              setIsEditingUser(false);
          }
      }
  };

  // --- Vehicle Handlers ---
  const handleVehicleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newVehicle = {
          ...vehicleFormData,
          hourlyRate: Number(vehicleFormData.hourlyRate) || 0
      };
      
      if (isEditingVehicle && vehicleFormData.id) {
          editVehicle(vehicleFormData.id, newVehicle);
          alert("Veículo atualizado!");
      } else {
          addVehicle(newVehicle);
          alert("Veículo cadastrado!");
      }
      
      setVehicleFormData(initialVehicleForm);
      setIsEditingVehicle(false);
  };

  const handleEditVehicleClick = (v: Vehicle) => {
      setVehicleFormData({
          id: v.id,
          model: v.model,
          plate: v.plate,
          tag: v.tag || '',
          hourlyRate: v.hourlyRate || 0
      });
      setIsEditingVehicle(true);
  };

  const handleCancelVehicleEdit = () => {
      setVehicleFormData(initialVehicleForm);
      setIsEditingVehicle(false);
  };

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const aiStats = {
        avgTravelTime: stats.avgTravelTime,
        avgTaskTime: stats.avgTaskTime,
        totalTripsToday: stats.totalTripsPeriod,
        totalTasksToday: stats.totalTasksPeriod,
        totalCostPeriod: stats.totalCostPeriod,
        tasksPerDriver: [],
        requestsPerUser: [],
        dailyActivity: []
    };
    const text = await generateProductivityInsight(aiStats);
    setInsight(text);
    setLoadingInsight(false);
  };

  // --- Video Generation ---
  const handleGenerateVideo = async () => {
      if (!hasApiKey) {
          await handleSelectApiKey();
          return;
      }
      if (!videoPrompt.trim()) {
          alert("Por favor, descreva o vídeo desejado.");
          return;
      }
      setIsGeneratingVideo(true);
      try {
          // Use user prompt
          const url = await generatePromoVideo(videoPrompt);
          if (url) setVideoUrl(url);
      } catch (error) {
          alert("Erro ao gerar vídeo. Tente novamente.");
      } finally {
          setIsGeneratingVideo(false);
      }
  };


  // --- Export Functions ---

  const handleExportExcel = () => {
    const data = filteredRequests.map(req => {
        const v = getVehicleDetails(req.vehicleId);
        return {
            ID: req.id,
            Status: STATUS_PT[req.status] || req.status,
            Prioridade: req.priority || 'NORMAL',
            Solicitante: req.solicitorName,
            CR: req.cr || '-',
            'C.C': req.cc || '-',
            Motorista: req.driverName || 'Não atribuído',
            Veículo: v.model,
            TAG: v.tag,
            'Custo (R$)': req.finalCost ? req.finalCost.toFixed(2) : '-',
            Destino: req.destination,
            Tarefa: req.taskDescription,
            'Viagem (min)': Math.floor(req.travelDuration / 60),
            'Tarefa (min)': Math.floor(req.workDuration / 60),
            'Data': new Date(req.createdAt).toLocaleDateString(),
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);

    XLSX.utils.sheet_add_aoa(ws, [
        ["Relatório de Produtividade & Custos - DriverPro"],
        ["Gerado em: " + new Date().toLocaleString()],
        [`Período: ${dateStart || 'Início'} até ${dateEnd || 'Hoje'}`],
        [`Custo Total do Período: R$ ${stats.totalCostPeriod.toFixed(2)}`],
        [""]
    ], { origin: "A1" });

    XLSX.utils.sheet_add_json(ws, data, { origin: "A6" });
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, "DriverPro_Relatorio.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Produtividade - DriverPro", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Período: ${dateStart || 'Início'} até ${dateEnd || 'Hoje'}`, 14, 33);
    doc.text(`Custo Total: R$ ${stats.totalCostPeriod.toFixed(2)}`, 14, 38);

    const tableData = filteredRequests.map(req => {
        const v = getVehicleDetails(req.vehicleId);
        return [
            req.id,
            STATUS_PT[req.status] || req.status,
            req.driverName || '-',
            v.tag !== '-' ? v.tag : v.model,
            req.finalCost ? `R$ ${req.finalCost.toFixed(2)}` : '-',
            req.destination.substring(0, 20),
            new Date(req.createdAt).toLocaleDateString()
        ]
    });

    autoTable(doc, {
        head: [['ID', 'Status', 'Mot.', 'Veículo/TAG', 'Custo', 'Destino', 'Data']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save("DriverPro_Relatorio.pdf");
  };

  // --- Report Specific Exports ---
  const handleReportExport = (type: 'excel' | 'pdf') => {
      if (reportTab === 'users') {
          // Export Users
          if (type === 'excel') {
              const data = users.map(u => ({
                  Nome: u.name,
                  Email: u.email,
                  CPF: u.cpf,
                  Função: u.role,
                  CR: u.cr || '-'
              }));
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet(data);
              XLSX.utils.book_append_sheet(wb, ws, "Usuários");
              XLSX.writeFile(wb, "Relatorio_Usuarios.xlsx");
          } else {
              const doc = new jsPDF();
              doc.text("Relatório de Usuários", 14, 20);
              doc.setFontSize(10);
              doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 26);
              autoTable(doc, {
                  head: [['Nome', 'Email', 'CPF', 'Função', 'CR']],
                  body: users.map(u => [u.name, u.email, u.cpf, u.role, u.cr || '-']),
                  startY: 30
              });
              doc.save("Relatorio_Usuarios.pdf");
          }
      } else if (reportTab === 'vehicles') {
          // Export Vehicles
          if (type === 'excel') {
              const data = vehicles.map(v => ({
                  Modelo: v.model,
                  Placa: v.plate,
                  TAG: v.tag || '-',
                  'Valor Hora': v.hourlyRate || 0
              }));
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet(data);
              XLSX.utils.book_append_sheet(wb, ws, "Frota");
              XLSX.writeFile(wb, "Relatorio_Frota.xlsx");
          } else {
              const doc = new jsPDF();
              doc.text("Relatório de Frota", 14, 20);
              doc.setFontSize(10);
              doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 26);
              autoTable(doc, {
                  head: [['Modelo', 'Placa', 'TAG', 'Valor Hora']],
                  body: vehicles.map(v => [v.model, v.plate, v.tag || '-', v.hourlyRate ? `R$ ${v.hourlyRate.toFixed(2)}` : '-']),
                  startY: 30
              });
              doc.save("Relatorio_Frota.pdf");
          }
      } else if (reportTab === 'costs') {
          // Export Costs (Flattened Data)
          const flatData: any[] = [];
          Object.entries(costsByCC).forEach(([cc, data]: [string, { total: number, items: TaskRequest[] }]) => {
              data.items.forEach(item => {
                  const v = getVehicleDetails(item.vehicleId);
                  flatData.push({
                      CC: item.cc || '-',
                      Data: new Date(item.createdAt).toLocaleDateString(),
                      ID: item.id,
                      Motorista: item.driverName || 'Não atribuído',
                      Localizacao: item.driverStartLocation || 'N/A',
                      Destino: item.destination,
                      Solicitante: item.solicitorName,
                      Veiculo: `${v.model} (${v.plate})`,
                      Custo: item.finalCost || 0
                  });
              });
          });

          if (type === 'excel') {
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet(flatData);
              XLSX.utils.book_append_sheet(wb, ws, "Custos");
              XLSX.writeFile(wb, "Relatorio_Custos_CC.xlsx");
          } else {
              const doc = new jsPDF('l'); // Landscape
              doc.text("Relatório Detalhado de Custos por C.C", 14, 20);
              doc.setFontSize(10);
              doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 26);
              autoTable(doc, {
                  head: [['C.C', 'Data', 'ID', 'Motorista', 'Loc. Início', 'Destino', 'Veículo', 'Custo']],
                  body: flatData.map(i => [i.CC, i.Data, i.ID, i.Motorista, i.Localizacao, i.Destino, i.Veiculo, `R$ ${i.Custo.toFixed(2)}`]),
                  startY: 30,
                  styles: { fontSize: 8 },
                  columnStyles: { 5: { cellWidth: 40 } } // Destino column width restriction
              });
              doc.save("Relatorio_Custos_CC.pdf");
          }
      }
  };

  const ExportButtons = () => (
      <div className="flex items-center gap-2">
          <button onClick={() => handleReportExport('excel')} className="flex items-center gap-1 text-green-600 hover:text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 text-sm font-medium transition hover:shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => handleReportExport('pdf')} className="flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-medium transition hover:shadow-sm">
              <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1 text-slate-600 hover:text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium transition hover:shadow-sm">
              <Printer className="w-4 h-4" /> Imprimir
          </button>
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 pb-20">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel Administrativo</h1>
          <p className="text-slate-500">
             {view === 'dashboard' && 'Gestão de frota, usuários, custos e relatórios de desempenho.'}
             {view === 'users' && 'Gestão de Usuários e Permissões.'}
             {view === 'vehicles' && 'Cadastro e Manutenção de Frota.'}
             {view === 'marketing' && 'Estúdio de Criação com IA.'}
             {view === 'reports' && 'Relatórios Detalhados e Exportação.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button 
                onClick={refreshData}
                className={`px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm flex items-center gap-2 ${isLoading ? 'opacity-50' : ''}`}
                disabled={isLoading}
            >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium hidden sm:inline">Atualizar Dados</span>
            </button>
        </div>
      </header>

      {view === 'marketing' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
                  
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 relative z-10">
                      <Sparkles className="w-6 h-6 text-yellow-300" />
                      DriverPro: AI Video Studio
                  </h2>
                  <p className="text-purple-100 max-w-3xl text-lg leading-relaxed mb-6 relative z-10">
                      Crie vídeos promocionais cinematográficos para apresentar o <strong>DriverPro</strong> à sua equipe, investidores ou novos clientes. Utilize o poder do <strong>Google Veo</strong> para gerar conteúdo visual de alto impacto.
                  </p>
                  
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-xl relative z-10">
                      <label className="block text-sm font-bold text-purple-200 uppercase mb-2 flex items-center gap-2">
                          <Clapperboard className="w-4 h-4" /> Roteiro do Vídeo (Prompt)
                      </label>
                      <textarea 
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-4 text-white placeholder-purple-300/50 focus:ring-2 focus:ring-yellow-400 outline-none h-32 resize-none"
                          value={videoPrompt}
                          onChange={(e) => setVideoPrompt(e.target.value)}
                          placeholder="Descreva o vídeo que você deseja criar..."
                      />
                      <p className="text-xs text-purple-300 mt-2 text-right">Dica: Seja detalhado sobre o ambiente, iluminação e a ação dos personagens.</p>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-4 relative z-10">
                      {!hasApiKey ? (
                          <button onClick={handleSelectApiKey} className="bg-white text-purple-700 font-bold py-3 px-6 rounded-lg hover:bg-purple-50 transition flex items-center gap-2 shadow-lg">
                              <Key className="w-4 h-4" /> Selecionar Chave API (Cobrança)
                          </button>
                      ) : (
                          <button onClick={handleGenerateVideo} disabled={isGeneratingVideo} className="bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                              {isGeneratingVideo ? <><RefreshCw className="w-5 h-5 animate-spin" /> Criando Vídeo (Pode demorar um pouco)...</> : <><Play className="w-5 h-5 fill-current" /> Gerar Vídeo de Apresentação</>}
                          </button>
                      )}
                  </div>
              </div>

              {/* Video Result Area */}
              {videoUrl && (
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-in slide-in-from-bottom-4">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              <Video className="w-5 h-5 text-purple-600" /> Resultado Gerado
                          </h3>
                          <a href={videoUrl} download="driverpro-promo.mp4" className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-2">
                              <Download className="w-4 h-4" /> Baixar MP4
                          </a>
                      </div>
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
                          <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
                      </div>
                  </div>
              )}
          </div>
      )}
      
      {view === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
              {/* Report Tabs */}
              <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
                  <button onClick={() => setReportTab('users')} className={`px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap ${reportTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                      <Users className="w-4 h-4" /> Usuários Cadastrados
                  </button>
                  <button onClick={() => setReportTab('vehicles')} className={`px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap ${reportTab === 'vehicles' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                      <Car className="w-4 h-4" /> Frota Cadastrada
                  </button>
                  <button onClick={() => setReportTab('costs')} className={`px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap ${reportTab === 'costs' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                      <CreditCard className="w-4 h-4" /> Custos por C.C
                  </button>
              </div>

              {/* USER REPORT */}
              {reportTab === 'users' && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                          <h2 className="text-lg font-bold text-slate-800">Relatório Geral de Usuários</h2>
                          <ExportButtons />
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                              <thead>
                                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                                      <th className="py-3 px-4">Nome</th>
                                      <th className="py-3 px-4">Email</th>
                                      <th className="py-3 px-4">CPF</th>
                                      <th className="py-3 px-4">Função</th>
                                      <th className="py-3 px-4">CR</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {users.map(u => (
                                      <tr key={u.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                                          <td className="py-3 px-4 font-medium">{u.name}</td>
                                          <td className="py-3 px-4 text-slate-600">{u.email}</td>
                                          <td className="py-3 px-4 font-mono text-slate-500">{u.cpf}</td>
                                          <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                                          <td className="py-3 px-4 text-slate-600">{u.cr || '-'}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {/* VEHICLE REPORT */}
              {reportTab === 'vehicles' && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                          <h2 className="text-lg font-bold text-slate-800">Relatório Geral da Frota</h2>
                          <ExportButtons />
                      </div>
                      {vehicles.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 border border-dashed rounded-lg">Nenhum veículo cadastrado na frota.</div>
                      ) : (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead>
                                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                                          <th className="py-3 px-4">Modelo</th>
                                          <th className="py-3 px-4">Placa</th>
                                          <th className="py-3 px-4">TAG</th>
                                          <th className="py-3 px-4">Valor Hora</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {vehicles.map(v => (
                                          <tr key={v.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                                              <td className="py-3 px-4 font-medium">{v.model}</td>
                                              <td className="py-3 px-4 font-mono bg-slate-50 w-fit px-2 rounded text-slate-700">{v.plate}</td>
                                              <td className="py-3 px-4 text-slate-600">{v.tag || '-'}</td>
                                              <td className="py-3 px-4 font-bold text-emerald-600">{v.hourlyRate ? `R$ ${v.hourlyRate.toFixed(2)}` : '-'}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              )}

              {/* COSTS BY CC REPORT */}
              {reportTab === 'costs' && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {Object.entries(costsByCC).map(([cc, data]: [string, { total: number, items: TaskRequest[] }]) => (
                               <div key={cc} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                   <div className="flex items-center gap-3 mb-2">
                                       <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><DollarSign className="w-5 h-5" /></div>
                                       <h3 className="font-bold text-slate-700">C.C: {cc}</h3>
                                   </div>
                                   <p className="text-2xl font-bold text-slate-900 mb-1">R$ {data.total.toFixed(2)}</p>
                                   <p className="text-xs text-slate-500">{data.items.length} lançamentos contabilizados</p>
                               </div>
                           ))}
                      </div>

                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                              <h2 className="text-lg font-bold text-slate-800">Detalhamento de Custos por Centro de Custo</h2>
                              <ExportButtons />
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead>
                                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                                          <th className="py-3 px-4">Centro de Custo (C.C)</th>
                                          <th className="py-3 px-4">Data</th>
                                          <th className="py-3 px-4">ID</th>
                                          <th className="py-3 px-4">Motorista</th>
                                          <th className="py-3 px-4">Localização</th>
                                          <th className="py-3 px-4">Destino</th>
                                          <th className="py-3 px-4">Solicitante</th>
                                          <th className="py-3 px-4">Veículo Utilizado</th>
                                          <th className="py-3 px-4 text-right">Custo Lançado</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {Object.entries(costsByCC).length === 0 ? (
                                           <tr><td colSpan={9} className="py-8 text-center text-slate-400">Nenhum custo lançado no sistema.</td></tr>
                                      ) : (
                                          Object.entries(costsByCC).map(([cc, data]: [string, { total: number, items: TaskRequest[] }]) => (
                                              <React.Fragment key={cc}>
                                                  {/* Group Header Row */}
                                                  <tr className="bg-slate-50 border-b border-slate-200">
                                                      <td colSpan={9} className="py-2 px-4 font-bold text-slate-700 text-xs uppercase">
                                                          {cc} - Total: R$ {data.total.toFixed(2)}
                                                      </td>
                                                  </tr>
                                                  {/* Items Rows */}
                                                  {data.items.map(item => {
                                                       const vDetails = getVehicleDetails(item.vehicleId);
                                                       return (
                                                          <tr key={item.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                                                              <td className="py-3 px-4 text-slate-500 text-xs font-mono">{item.cc || '-'}</td>
                                                              <td className="py-3 px-4 text-slate-600 text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
                                                              <td className="py-3 px-4 text-slate-400 text-xs">#{item.id}</td>
                                                              <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">{item.driverName || '-'}</td>
                                                              <td className="py-3 px-4 text-slate-500 text-xs truncate max-w-[150px]" title={item.driverStartLocation}>{item.driverStartLocation || 'N/A'}</td>
                                                              <td className="py-3 px-4 truncate max-w-[200px]" title={item.destination}>{item.destination}</td>
                                                              <td className="py-3 px-4 text-slate-600">{item.solicitorName}</td>
                                                              <td className="py-3 px-4 text-xs text-slate-500">{vDetails.model} ({vDetails.plate})</td>
                                                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">R$ {item.finalCost?.toFixed(2)}</td>
                                                          </tr>
                                                       );
                                                  })}
                                              </React.Fragment>
                                          ))
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                    <Filter className="w-4 h-4" /> Período:
                </div>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white" />
                <span className="text-xs text-slate-500">ATÉ</span>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white" />
                {(dateStart || dateEnd) && (
                    <button onClick={() => { setDateStart(''); setDateEnd(''); }} className="text-xs text-red-500 hover:underline">Limpar</button>
                )}
            </div>

            {/* Main KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Truck size={20} /></div>
                        <h3 className="text-sm font-medium text-slate-500">Tempo Médio Percurso</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{(stats.avgTravelTime / 60).toFixed(0)} min</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600"><Timer size={20} /></div>
                        <h3 className="text-sm font-medium text-slate-500">Tempo Médio Tarefa</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{(stats.avgTaskTime / 60).toFixed(0)} min</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><DollarSign size={20} /></div>
                        <h3 className="text-sm font-medium text-slate-500">Custo Total (Período)</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">R$ {stats.totalCostPeriod.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Users size={20} /></div>
                        <h3 className="text-sm font-medium text-slate-500">Tarefas (Período)</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{stats.totalTasksPeriod}</p>
                </div>
            </div>

            {/* AI Insight */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" /> Análise de Inteligência Artificial
                    </h3>
                    <button onClick={handleGenerateInsight} disabled={loadingInsight} className="text-xs bg-white px-3 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                        {loadingInsight ? "Analisando..." : "Gerar Insight"}
                    </button>
                </div>
                <p className="text-indigo-800 text-sm leading-relaxed">
                    {insight || "Clique em 'Gerar Insight' para receber uma análise de produtividade e custos da sua frota."}
                </p>
            </div>

            {/* Advanced Charts Section 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Distribuição de Prioridade</h3>
                    <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {stats.priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Urgente' ? PRIORITY_COLORS[TaskPriority.URGENT] : entry.name === 'Importante' ? PRIORITY_COLORS[TaskPriority.IMPORTANT] : PRIORITY_COLORS[TaskPriority.NORMAL]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Chart 2: Cost By Vehicle (NEW) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Car className="w-4 h-4 text-blue-500" /> Custo por Veículo (R$)
                    </h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.costByVehicle} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 10}} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="value" name="Custo Total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.costByVehicle.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* AI Suggested Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Chart 1: Daily Cost Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" /> Evolução de Custos Diários
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={stats.dailyCostTrend}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{fontSize: 10}} />
                                <YAxis tick={{fontSize: 10}} />
                                <Tooltip />
                                <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorCost)" name="Custo (R$)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    {stats.dailyCostTrend.length === 0 && <p className="text-xs text-slate-400 text-center mt-2">Dados insuficientes para análise de tendência.</p>}
                </div>

                {/* AI Chart 2: Operational Efficiency */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" /> Índice de Eficiência Operacional (AI Insight)
                    </h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.efficiencyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{fontSize: 10}} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="efficiencyScore" name="Score de Eficiência (0-100)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                    {stats.efficiencyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.efficiencyScore > 85 ? '#10b981' : entry.efficiencyScore > 70 ? '#f59e0b' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2">Score calculado com base na relação Tempo de Deslocamento vs Tempo de Execução.</p>
                </div>
            </div>

            {/* Request Monitoring Table */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Search className="w-5 h-5 text-slate-500" /> Monitoramento da Frota
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={handleExportExcel} className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-sm" title="Baixar Excel">
                            <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
                        </button>
                        <button onClick={handleExportPDF} className="flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-sm" title="Baixar PDF">
                            <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
                        </button>
                        <select value={filterDriverId} onChange={(e) => setFilterDriverId(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
                            <option value="ALL">Todos Motoristas</option>
                            {driversList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
                            <option value="ALL">Todos Status</option>
                            <option value={RequestStatus.PENDING}>Pendente</option>
                            <option value={RequestStatus.ACCEPTED}>Aceito</option>
                            <option value={RequestStatus.IN_TRANSIT}>Em Trânsito</option>
                            <option value={RequestStatus.EXECUTING}>Executando</option>
                            <option value={RequestStatus.COMPLETED}>Concluído</option>
                            <option value={RequestStatus.REJECTED}>Recusado</option>
                            <option value={RequestStatus.CANCELLED}>Cancelado</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider bg-slate-50">
                                <th className="py-3 px-4">ID</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Solicitante</th>
                                <th className="py-3 px-4">C.C</th>
                                <th className="py-3 px-4">Motorista</th>
                                <th className="py-3 px-4">Veículo</th>
                                <th className="py-3 px-4">TAG</th>
                                <th className="py-3 px-4 text-center">Custo</th>
                                <th className="py-3 px-4">Destino</th>
                                <th className="py-3 px-4 text-center">Tempos</th>
                                <th className="py-3 px-4 text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.length === 0 ? (
                                <tr><td colSpan={11} className="py-8 text-center text-slate-400 text-sm">Nenhuma solicitação encontrada no período selecionado.</td></tr>
                            ) : (
                                filteredRequests.map(req => {
                                    const vDetails = getVehicleDetails(req.vehicleId);
                                    return (
                                        <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                                            <td className="py-3 px-4 text-slate-400 font-mono text-xs">#{req.id}</td>
                                            <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                                            <td className="py-3 px-4 font-medium text-slate-700">
                                                {req.solicitorName}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-mono text-xs">{req.cc || '-'}</td>
                                            <td className="py-3 px-4 text-slate-600 font-medium">
                                                {req.driverName || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 text-xs truncate max-w-[100px]" title={vDetails.model}>
                                                {vDetails.model}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 text-xs font-mono">
                                                {vDetails.tag}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
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

      {view === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit sticky top-24">
                <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        {isEditingUser ? <Pencil className="w-5 h-5 text-amber-500" /> : <UserPlus className="w-5 h-5 text-blue-500" />}
                        {isEditingUser ? 'Editar Usuário' : 'Cadastrar Usuário'}
                    </span>
                    {isEditingUser && (
                        <button onClick={() => { setIsEditingUser(false); setUserFormData(initialUserForm); }} className="text-xs text-red-500 flex items-center gap-1 hover:underline"><X className="w-3 h-3" /> Cancelar</button>
                    )}
                </h2>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                        <select className="w-full border p-2 rounded" value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as UserRole})}>
                            <option value={UserRole.DRIVER}>Motorista</option>
                            <option value={UserRole.SOLICITOR}>Solicitante</option>
                            <option value={UserRole.SOLICITOR_ADMIN}>Solicitante + Admin</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                    </div>
                    {userFormData.role === UserRole.DRIVER && (
                        <>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Veículo Padrão</label>
                                <select 
                                    className="w-full border p-2 rounded" 
                                    value={userFormData.defaultVehicleId} 
                                    onChange={e => setUserFormData({...userFormData, defaultVehicleId: e.target.value})}
                                >
                                    <option value="">Nenhum / Selecionar na tarefa</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.tag || v.plate || 'Sem Identificação'}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                    <input type="text" className="w-full border p-2 rounded" placeholder="CR" value={userFormData.cr} onChange={e => setUserFormData({...userFormData, cr: e.target.value})} />
                    <input required type="text" className="w-full border p-2 rounded" placeholder="Nome Completo" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} />
                    <input required type="text" className="w-full border p-2 rounded" placeholder="CPF" value={userFormData.cpf} onChange={e => setUserFormData({...userFormData, cpf: e.target.value})} />
                    <input required type="password" className="w-full border p-2 rounded" placeholder="Senha" value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} />
                    <input required type="email" className="w-full border p-2 rounded" placeholder="Email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
                    
                    <button type="submit" className={`w-full text-white py-2 rounded font-medium transition ${isEditingUser ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                        {isEditingUser ? 'Salvar Alterações' : 'Cadastrar'}
                    </button>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold mb-4">Usuários Cadastrados</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500 text-sm">
                                <th className="py-2 px-2">Nome/Email</th>
                                <th className="py-2 px-2">Função</th>
                                <th className="py-2 px-2">Detalhes</th>
                                <th className="py-2 px-2 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                                    <td className="py-3 px-2 font-medium text-slate-800">
                                        {u.name}
                                        <div className="text-xs text-slate-400 font-normal">{u.email}</div>
                                    </td>
                                    <td className="py-3 px-2">{getRoleBadge(u.role)}</td>
                                    <td className="py-3 px-2 text-xs text-slate-500">
                                        {u.cr && <div>CR: {u.cr}</div>}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEditUserClick(u)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteUserClick(u.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {view === 'vehicles' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
              <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                   <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
                       <span className="flex items-center gap-2">
                           <Car className="w-5 h-5 text-blue-500" /> 
                           {isEditingVehicle ? 'Editar Veículo' : 'Cadastrar Veículo'}
                       </span>
                       {isEditingVehicle && (
                            <button onClick={handleCancelVehicleEdit} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                                <X className="w-3 h-3" /> Cancelar
                            </button>
                       )}
                   </h2>
                   <form onSubmit={handleVehicleSubmit} className="space-y-4">
                       <input required type="text" className="w-full border p-2 rounded" placeholder="Modelo (Ex: Fiat Strada)" value={vehicleFormData.model} onChange={e => setVehicleFormData({...vehicleFormData, model: e.target.value})} />
                       <input required type="text" className="w-full border p-2 rounded" placeholder="Placa (Ex: ABC-1234)" value={vehicleFormData.plate} onChange={e => setVehicleFormData({...vehicleFormData, plate: e.target.value})} />
                       <input type="text" className="w-full border p-2 rounded" placeholder="TAG Sem Parar (Opcional)" value={vehicleFormData.tag} onChange={e => setVehicleFormData({...vehicleFormData, tag: e.target.value})} />
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Hora (R$)</label>
                           <input 
                               type="number" 
                               step="0.01" 
                               className="w-full border p-2 rounded" 
                               placeholder="0.00" 
                               value={vehicleFormData.hourlyRate} 
                               onChange={e => setVehicleFormData({...vehicleFormData, hourlyRate: Number(e.target.value)})} 
                           />
                       </div>
                       <button type="submit" className={`w-full text-white py-2 rounded hover:bg-opacity-90 transition ${isEditingVehicle ? 'bg-amber-600' : 'bg-slate-900'}`}>
                           {isEditingVehicle ? 'Salvar Alterações' : 'Salvar Veículo'}
                       </button>
                   </form>
              </div>
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h2 className="text-lg font-bold mb-4">Frota Cadastrada</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500 text-sm">
                                <th className="py-2 px-2">Modelo</th>
                                <th className="py-2 px-2">Placa</th>
                                <th className="py-2 px-2">TAG</th>
                                <th className="py-2 px-2">R$ Hora</th>
                                <th className="py-2 px-2 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vehicles.map(v => (
                                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                                    <td className="py-3 px-2 font-medium">{v.model}</td>
                                    <td className="py-3 px-2 font-mono bg-slate-50 w-fit px-2 rounded">{v.plate}</td>
                                    <td className="py-3 px-2 text-xs text-slate-500">{v.tag || '-'}</td>
                                    <td className="py-3 px-2 text-emerald-600 font-bold">{v.hourlyRate ? `R$ ${v.hourlyRate.toFixed(2)}` : '-'}</td>
                                    <td className="py-3 px-2 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEditVehicleClick(v)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => { if(confirm('Excluir veículo?')) deleteVehicle(v.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};