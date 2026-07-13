import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Target, Quote, X, Clock, BookOpen, TrendingUp, BarChart2, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { getWeeklyReadingStats, seedMockStats } from '../../lib/stats';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReadingDashboard({ isOpen, onClose }: Props) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      seedMockStats();
      setData(getWeeklyReadingStats());
    }
  }, [isOpen]);

  const totalReadingTime = data.reduce((sum, day) => sum + day.readingTime, 0);
  const totalChapters = data.reduce((sum, day) => sum + day.chaptersRead, 0);
  const avgReadingTime = Math.round(totalReadingTime / 7);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <BarChart2 size={20} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-white tracking-tight font-serif">Reading Dashboard</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar">
            {/* Daily Quote */}
            <div className="mb-8">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 relative overflow-hidden">
                <Quote size={120} className="absolute -right-4 -bottom-8 text-white/5 rotate-12 pointer-events-none" />
                <div className="flex items-center gap-2 mb-4 text-blue-400">
                  <Quote size={16} />
                  <span className="text-xs font-semibold uppercase tracking-widest">Daily Quote</span>
                </div>
                {(() => {
                  const quotes = JSON.parse(localStorage.getItem('reader_saved_quotes') || '[]');
                  if (quotes.length > 0) {
                    const quote = quotes[Math.floor(Math.random() * quotes.length)];
                    return (
                      <div className="relative z-10">
                        <p className="text-lg md:text-xl font-serif italic text-white/90 leading-relaxed mb-3">"{quote.text}"</p>
                        {quote.note && <p className="text-sm text-white/50 bg-black/20 p-3 rounded-lg border border-white/5 inline-block">— {quote.note}</p>}
                      </div>
                    );
                  }
                  return <p className="text-sm text-white/40 italic">Save quotes while reading to see them here.</p>;
                })()}
              </div>
            </div>
            
            
            {/* Daily Goal & Streak */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="md:col-span-1 p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 flex flex-col justify-center items-center text-center">
                <Flame size={48} className="text-orange-500 mb-2 animate-pulse" />
                <h3 className="text-3xl font-light text-white mb-1">
                  {localStorage.getItem('reading_streak') || '0'}
                </h3>
                <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">Day Streak</span>
              </div>
              
              <div className="md:col-span-3 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 text-white/80">
                    <Calendar size={18} className="text-blue-400" />
                    <h3 className="text-sm font-medium">Activity Calendar</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-white/5"></div> Missed</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500/40"></div> Read</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500"></div> Met Goal</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                  {(() => {
                    const goal = parseInt(localStorage.getItem('reading_goal') || '20');
                    const today = new Date().getDay();
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    
                    return Array.from({length: 14}).map((_, i) => {
                      // Generate some mock history + real data for today
                      let isToday = i === 13;
                      let metGoal = false;
                      let someReading = false;
                      let dayLabel = days[(today - (13 - i) + 14) % 7];
                      
                      if (isToday) {
                        const readTime = parseInt(localStorage.getItem('daily_read_time') || '0');
                        metGoal = readTime >= goal;
                        someReading = readTime > 0;
                      } else {
                        // Mock previous days
                        const rnd = Math.random();
                        metGoal = rnd > 0.4; // 60% chance met goal
                        someReading = rnd > 0.2; // 80% chance some reading
                      }
                      
                      return (
                        <div key={i} className="flex flex-col items-center gap-2">
                          <div 
                            className={`w-full aspect-square rounded-md border ${
                              metGoal 
                                ? 'bg-blue-500 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                                : someReading 
                                  ? 'bg-blue-500/40 border-blue-500/50' 
                                  : 'bg-white/5 border-white/10'
                            } transition-colors`}
                            title={isToday ? 'Today' : ''}
                          />
                          <span className={`text-[10px] ${isToday ? 'text-blue-400 font-bold' : 'text-white/40'}`}>
                            {dayLabel}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
\n            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-white/50 mb-2">
                  <Clock size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Weekly Time</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-light text-white">{totalReadingTime}</span>
                  <span className="text-sm text-white/40 pb-1">minutes</span>
                </div>
              </div>
              
              <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-white/50 mb-2">
                  <BookOpen size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Chapters Read</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-light text-white">{totalChapters}</span>
                  <span className="text-sm text-white/40 pb-1">chapters</span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-white/50 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Daily Avg</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-light text-white">{avgReadingTime}</span>
                  <span className="text-sm text-white/40 pb-1">min / day</span>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reading Time Area Chart */}
              <div className="p-5 rounded-xl bg-black/20 border border-white/5">
                <h3 className="text-sm font-medium text-white/80 mb-6">Reading Time (Minutes)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="readingTime" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTime)" activeDot={{ r: 6, fill: '#3b82f6' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chapters Progress Bar Chart */}
              <div className="p-5 rounded-xl bg-black/20 border border-white/5">
                <h3 className="text-sm font-medium text-white/80 mb-6">Chapters Progress</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="chaptersRead" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
