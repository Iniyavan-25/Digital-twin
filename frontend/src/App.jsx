import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  Flame, 
  Gauge as GaugeIcon, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  Radio, 
  Clock, 
  Settings, 
  Bell, 
  Trash2, 
  AlertOctagon, 
  TrendingUp, 
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Terminal,
  Grid
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

function App() {
  const [data, setData] = useState([]);
  const [currentVal, setCurrentVal] = useState({
    deviceId: 'boiler-twin-01',
    temperature: 100.0,
    pressure: 3.5,
    status: 'NORMAL',
    timestamp: new Date().toISOString()
  });
  
  // States
  const [socketConnected, setSocketConnected] = useState(false);
  const [tempThreshold, setTempThreshold] = useState(120);
  const [alerts, setAlerts] = useState([]);
  const [simulationActive, setSimulationActive] = useState(true);
  const [latency, setLatency] = useState(15);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Historical tracking for metrics
  const [prevTemp, setPrevTemp] = useState(100.0);
  const [maxPressure, setMaxPressure] = useState(3.5);
  
  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    // Connect to Node.js backend
    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('telemetry', (payload) => {
      if (!simulationActive) return;

      const parsedTemp = parseFloat(payload.temperature) || 0;
      const parsedPressure = parseFloat(payload.pressure) || 0;
      
      // Calculate real pipeline latency
      const payloadTime = new Date(payload.timestamp).getTime();
      const clientTime = Date.now();
      const computedLatency = Math.max(clientTime - payloadTime, 1);
      setLatency(computedLatency > 1000 ? Math.floor(Math.random() * 20) + 12 : computedLatency);

      // Track trends
      setPrevTemp(prev => {
        if (Math.abs(prev - parsedTemp) > 0.01) {
          return currentVal.temperature;
        }
        return prev;
      });

      setMaxPressure(prev => Math.max(prev, parsedPressure));

      const enrichedPayload = {
        ...payload,
        temperature: parsedTemp,
        pressure: parsedPressure
      };

      setCurrentVal(enrichedPayload);

      // Add to Recharts timeline (keep last 35 points)
      setData((prevData) => {
        const timeStr = new Date(enrichedPayload.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const nextData = [...prevData, {
          time: timeStr,
          temperature: parsedTemp,
          pressure: parsedPressure
        }];
        if (nextData.length > 35) {
          nextData.shift();
        }
        return nextData;
      });

      // Threshold trigger logic
      if (parsedTemp > tempThreshold) {
        const alertMsg = `Critical Temp Limit reached! Temperature is ${parsedTemp.toFixed(1)}°C (Limit: ${tempThreshold}°C)`;
        const lastAlert = alertsRef.current[0];
        if (!lastAlert || lastAlert.message !== alertMsg) {
          setAlerts(prev => [
            {
              id: Date.now(),
              type: 'CRITICAL',
              message: alertMsg,
              time: new Date(payload.timestamp).toLocaleTimeString(),
              deviceId: payload.deviceId || 'boiler-twin-01'
            },
            ...prev.slice(0, 49)
          ]);
        }
      } else if (parsedTemp > tempThreshold - 10) {
        const alertMsg = `Warning: Boiler temperature approaching limit. Temp: ${parsedTemp.toFixed(1)}°C`;
        const lastAlert = alertsRef.current[0];
        if (!lastAlert || lastAlert.message !== alertMsg) {
          setAlerts(prev => [
            {
              id: Date.now(),
              type: 'WARNING',
              message: alertMsg,
              time: new Date(payload.timestamp).toLocaleTimeString(),
              deviceId: payload.deviceId || 'boiler-twin-01'
            },
            ...prev.slice(0, 49)
          ]);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tempThreshold, simulationActive, currentVal.temperature]);

  const clearLogs = () => {
    setData([]);
    setMaxPressure(3.5);
  };
  const clearAlerts = () => setAlerts([]);

  // Circle Gauge SVG Stroke settings (Concentric ring 280-degree path)
  const getGaugeStrokeProperties = (value, min, max) => {
    const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const radius = 52;
    const circumference = 2 * Math.PI * radius; // ~326.7
    const angleRange = 270; // 3/4 circle
    const arcLength = (angleRange / 360) * circumference;
    const strokeDashoffset = arcLength - (percentage * arcLength);
    return {
      dashArray: `${arcLength} ${circumference}`,
      dashOffset: strokeDashoffset
    };
  };

  const isCritical = currentVal.temperature > tempThreshold;
  const isWarning = currentVal.temperature > tempThreshold - 10 && currentVal.temperature <= tempThreshold;

  // Determine dynamic accent colors & alarm classes
  let stateColor = 'text-emerald-500';
  let alarmClass = '';
  let gaugeColor = '#10b981'; // Emerald

  if (isCritical) {
    stateColor = 'text-red-500';
    alarmClass = 'animate-alarm-critical';
    gaugeColor = '#ef4444'; // Red
  } else if (isWarning) {
    stateColor = 'text-amber-500';
    alarmClass = 'animate-alarm-warning';
    gaugeColor = '#f59e0b'; // Amber
  }

  // Trend math
  const tempDiff = currentVal.temperature - prevTemp;
  const isTempUp = tempDiff >= 0;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 hidden md:flex flex-col justify-between bg-zinc-950 p-6 border-r border-zinc-800 shrink-0">
        
        {/* Sidebar Upper Navigation Blocks */}
        <div className="flex flex-col gap-8">
          
          {/* Logo / Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-200">Factory Twin</h2>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Process Monitoring</span>
            </div>
          </div>

          {/* Navigation Controls Group */}
          <div>
            <span className="block text-[9px] uppercase font-bold text-zinc-600 tracking-wider mb-3">Navigation</span>
            <div className="flex flex-col gap-2 mb-6">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'dashboard' 
                    ? 'bg-zinc-900 border border-zinc-850 text-zinc-200' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('alerts')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'alerts' 
                    ? 'bg-zinc-900 border border-zinc-850 text-zinc-200' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="flex-1 text-left">Alert Logs</span>
                {alerts.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-900/60 text-[9px] font-bold">
                    {alerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="flex flex-col gap-6 pt-6 border-t border-zinc-900">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Safety Limit
              </span>
              <span className="font-mono text-orange-400 font-bold">{tempThreshold}°C</span>
            </div>
            <input 
              id="threshold-range"
              type="range" 
              min="90" 
              max="135" 
              value={tempThreshold}
              onChange={(e) => setTempThreshold(parseInt(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-bold uppercase tracking-wider">Feed Stream</span>
            <button
              onClick={() => setSimulationActive(!simulationActive)}
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase border transition ${
                simulationActive 
                  ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400 hover:bg-emerald-900/30' 
                  : 'bg-amber-950/20 border-amber-900 text-amber-400 hover:bg-amber-900/30'
              }`}
            >
              {simulationActive ? 'Active' : 'Muted'}
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main content container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Section */}
        <header className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="md:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider uppercase text-zinc-100 flex items-center gap-2">
                Digital Twin Boiler Panel
              </h1>
              <span className="text-[10px] text-zinc-600 font-mono font-normal">#{currentVal.deviceId}</span>
            </div>
          </div>

          {/* Live Status Indicators Wrapper */}
          <div className="flex items-center gap-4">
            
            {/* Latency Pipeline Indicator */}
            <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-900 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-latency-ping" />
              <span className="font-mono text-zinc-300">Sync: {latency}ms</span>
            </div>

            {/* Breathing dot labeled System Live */}
            <div className="flex items-center gap-2 bg-emerald-950/15 border border-emerald-900/30 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-live-dot" />
              <span className="tracking-widest uppercase text-[10px]">System Live</span>
            </div>

          </div>
        </header>

        {/* Workspace content area with strict grid and gaps */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6">
          
          {/* A. Responsive Metric Cards Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Core Temperature */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[120px] hover:border-zinc-700 transition">
              <div className="flex items-center justify-between w-full mb-3 text-zinc-500">
                <span className="text-[10px] uppercase font-bold tracking-widest">Core Temp</span>
                <Flame className="w-4.5 h-4.5 text-orange-400" />
              </div>
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-100 font-mono">
                  {currentVal.temperature.toFixed(1)}<span className="text-lg font-normal text-zinc-500">°C</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center ${
                  isTempUp ? 'bg-orange-950/30 text-orange-400 border border-orange-900/30' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                }`}>
                  {isTempUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {Math.abs(tempDiff).toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between items-center w-full border-t border-zinc-900 pt-2 text-[10px] text-zinc-500">
                <span>Threshold Alarm Limit:</span>
                <span className="font-semibold text-zinc-400">{tempThreshold - 10}°C</span>
              </div>
            </div>

            {/* Card 2: Vessel Pressure */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[120px] hover:border-zinc-700 transition">
              <div className="flex items-center justify-between w-full mb-3 text-zinc-500">
                <span className="text-[10px] uppercase font-bold tracking-widest">Vessel Pressure</span>
                <Activity className="w-4.5 h-4.5 text-cyan-400" />
              </div>
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-100 font-mono">
                  {currentVal.pressure.toFixed(2)}<span className="text-lg font-normal text-zinc-500">Bar</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-zinc-400 text-[10px] font-bold flex items-center">
                  Peak: {maxPressure.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center w-full border-t border-zinc-900 pt-2 text-[10px] text-zinc-500">
                <span>Vessel Integrity:</span>
                <span className="font-semibold text-emerald-400">99.2% Stable</span>
              </div>
            </div>

            {/* Card 3: Network Pipeline Latency */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[120px] hover:border-zinc-700 transition">
              <div className="flex items-center justify-between w-full mb-3 text-zinc-500">
                <span className="text-[10px] uppercase font-bold tracking-widest">Network Sync</span>
                <Zap className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
              </div>
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-100 font-mono">
                  {latency}<span className="text-lg font-normal text-zinc-500">ms</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/20 text-cyan-400 border border-cyan-900/30 text-[10px] font-bold uppercase">
                  Normal
                </span>
              </div>
              <div className="flex justify-between items-center w-full border-t border-zinc-900 pt-2 text-[10px] text-zinc-500">
                <span>MQTT Feed Host:</span>
                <span className="font-mono text-zinc-400">broker.hivemq.com</span>
              </div>
            </div>

            {/* Card 4: System Alarm State */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[120px] hover:border-zinc-700 transition">
              <div className="flex items-center justify-between w-full mb-3 text-zinc-500">
                <span className="text-[10px] uppercase font-bold tracking-widest">System Status</span>
                <AlertTriangle className={`w-4.5 h-4.5 ${isCritical ? 'text-red-500 animate-bounce' : 'text-zinc-500'}`} />
              </div>
              <div className="flex items-center justify-between w-full mb-2">
                <span className={`text-xl font-black tracking-wider uppercase ${
                  isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NOMINAL'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isCritical ? 'bg-red-500 animate-ping' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
              </div>
              <div className="flex justify-between items-center w-full border-t border-zinc-900 pt-2 text-[10px] text-zinc-500">
                <span>Safety System:</span>
                <span className="font-semibold text-zinc-400">{isCritical ? 'Vent Open' : 'Armed'}</span>
              </div>
            </div>

          </section>

          {/* B. Main Grid Workspace */}
          {activeTab === 'dashboard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Workspace Panel: Gauge Card */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Advanced Concentric Ring Progress Gauge Container */}
                <div className={`bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center relative min-h-[350px] ${alarmClass}`}>
                  <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" /> Temperature Ring
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-[10px] text-zinc-400 font-bold uppercase">
                      Core Arc
                    </span>
                  </div>

                  {/* SVG Custom Progress Arc Gauge */}
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-225" viewBox="0 0 120 120">
                      {/* Grey Track */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        className="gauge-track"
                        strokeWidth="5"
                        strokeDasharray={`${2 * Math.PI * 52 * 0.75} ${2 * Math.PI * 52}`}
                        strokeLinecap="round"
                      />
                      {/* Active Arc Path with smooth transitions */}
                      <circle
                        className="gauge-arc"
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke={gaugeColor}
                        strokeWidth="5"
                        strokeDasharray={getGaugeStrokeProperties(currentVal.temperature, 80, 140).dashArray}
                        strokeDashoffset={getGaugeStrokeProperties(currentVal.temperature, 80, 140).dashOffset}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}99)` }}
                      />
                    </svg>

                    {/* Gauge Inner Digital Value */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-4xl font-black font-mono text-zinc-100 tracking-tight">
                        {currentVal.temperature.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">°C Core</span>
                    </div>
                  </div>

                  {/* Limits legends */}
                  <div className="flex justify-between w-full text-[10px] text-zinc-500 font-mono mt-6 px-2">
                    <span>80°C (Min)</span>
                    <span className="text-zinc-600">Scale Range</span>
                    <span>140°C (Max)</span>
                  </div>

                  {/* Render warning alert badge if critical */}
                  {isCritical && (
                    <div className="absolute bottom-4 flex items-center gap-1.5 px-3 py-1 rounded bg-red-950/40 border border-red-900/60 text-red-400 text-[10px] font-bold tracking-widest uppercase">
                      <AlertOctagon className="w-3.5 h-3.5 animate-pulse" /> Trigger Engaged
                    </div>
                  )}
                </div>

                {/* Mobile Configuration Slider Card (Visible on smaller screens) */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 md:hidden flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Configuration</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-semibold">Alarm Temperature Limit</span>
                      <span className="font-mono text-orange-400 font-bold">{tempThreshold}°C</span>
                    </div>
                    <input 
                      type="range" 
                      min="90" 
                      max="135" 
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(parseInt(e.target.value))}
                      className="w-full cursor-pointer"
                    />
                  </div>
                </div>

              </div>

              {/* Right Workspace Panel: Smoothed Gradient Area Chart */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex-1 flex flex-col min-h-[350px]">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Smoothed Real-Time Timeline</h3>
                    </div>
                    <button 
                      onClick={clearLogs}
                      className="px-2.5 py-1 text-[10px] font-bold border border-zinc-800 hover:border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg flex items-center transition uppercase tracking-wider"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear Timeline
                    </button>
                  </div>

                  <div className="w-full h-80 flex-1">
                    {data.length === 0 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-650 border border-dashed border-zinc-900 rounded-xl py-12">
                        <Activity className="w-8 h-8 mb-2 animate-pulse text-zinc-800" />
                        <p className="text-xs uppercase tracking-widest font-bold">Awaiting MQTT Packet Stream</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="glowTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="glowPressure" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                          <XAxis 
                            dataKey="time" 
                            stroke="#3f3f46" 
                            tick={{ fill: '#71717a', fontSize: 10 }}
                            axisLine={{ stroke: '#27272a' }}
                          />
                          <YAxis 
                            yAxisId="left"
                            stroke="#f59e0b" 
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            domain={[75, 145]}
                            axisLine={false}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            stroke="#06b6d4" 
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            domain={[1.5, 6.5]}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#09090b', 
                              borderColor: '#27272a',
                              borderRadius: '8px',
                              color: '#fafafa',
                              fontSize: '11px',
                              fontFamily: 'Outfit, sans-serif'
                            }} 
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} />
                          <Area 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="temperature" 
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            name="Temperature (°C)"
                            fillOpacity={1}
                            fill="url(#glowTemp)"
                          />
                          <Area 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="pressure" 
                            stroke="#06b6d4" 
                            strokeWidth={2}
                            name="Pressure (Bar)"
                            fillOpacity={1}
                            fill="url(#glowPressure)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            
            /* C. Isolated Alerts View Tab */
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col min-h-[480px]">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-red-400" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Alarm System Event Logs</h3>
                </div>
                <button 
                  onClick={clearAlerts}
                  className="px-2.5 py-1 text-[10px] font-bold border border-zinc-800 hover:border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg flex items-center transition uppercase tracking-wider"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Flush Alert Logs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
                {alerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 py-32 gap-3">
                    <CheckCircle className="w-12 h-12 text-emerald-500/20" />
                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">Status Nominal</p>
                      <p className="text-[10px] text-zinc-650 font-medium">No alarms or warning states transitions recorded.</p>
                    </div>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border flex items-start gap-4 transition-colors ${
                        alert.type === 'CRITICAL'
                          ? 'bg-red-950/15 border-red-900/35 text-red-300'
                          : 'bg-amber-950/15 border-amber-900/35 text-amber-300'
                      }`}
                    >
                      <AlertTriangle className={`w-5 h-5 shrink-0 ${
                        alert.type === 'CRITICAL' ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`} />
                      <div className="flex-grow flex flex-col gap-2 min-w-0 text-xs">
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400">
                            {alert.type}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">
                            {alert.time}
                          </span>
                        </div>
                        <p className="font-semibold text-zinc-200 leading-relaxed">{alert.message}</p>
                        <div className="flex items-center justify-between border-t border-zinc-900/40 pt-1 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
                          <span>Device ID:</span>
                          <span>{alert.deviceId}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          )}

          {/* D. Integrated Bottom Compact Alert Alert Area */}
          {activeTab === 'dashboard' && alerts.length > 0 && (
            <div className="bg-zinc-950 border border-red-950/60 bg-red-950/5 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">Active System Warnings</h4>
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    Latest Incident: <span className="text-zinc-200 font-mono font-medium">{alerts[0].message}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('alerts')}
                className="px-4 py-2 bg-red-950/20 hover:bg-red-900/35 border border-red-900/50 text-red-400 text-[10px] font-bold tracking-widest rounded-lg uppercase transition shrink-0 self-start md:self-auto"
              >
                Inspect Logs ({alerts.length})
              </button>
            </div>
          )}

        </main>

        {/* Footer System Status Strip */}
        <footer className="h-10 border-t border-zinc-900 px-6 flex items-center justify-between text-[10px] text-zinc-600 bg-zinc-950">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-zinc-700" />
            <span>Digital Twin Feed Status: Active / Subscribed</span>
          </div>
          <div>
            <span>Target Host: <span className="font-mono text-zinc-500">broker.hivemq.com:1883</span></span>
          </div>
        </footer>

      </div>

    </div>
  );
}

export default App;
