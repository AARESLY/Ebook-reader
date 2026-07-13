import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

export interface ShelfStyle {
  woodType: 'oak' | 'mahogany' | 'pine' | 'ebony' | 'walnut';
  labelStyle: 'wood' | 'brass' | 'silver' | 'minimal';
}

export default function ShelfCustomizeModal({ 
  shelf, 
  onClose, 
  onSave 
}: { 
  shelf: any, 
  onClose: () => void, 
  onSave: (style: ShelfStyle) => void 
}) {
  const [woodType, setWoodType] = useState<ShelfStyle['woodType']>(shelf.woodType || 'oak');
  const [labelStyle, setLabelStyle] = useState<ShelfStyle['labelStyle']>(shelf.labelStyle || 'wood');

  const woodTypes = [
    { id: 'oak', name: 'Oak', color: '#d49964' },
    { id: 'mahogany', name: 'Mahogany', color: '#8b2525' },
    { id: 'pine', name: 'Pine', color: '#e6ccab' },
    { id: 'ebony', name: 'Ebony', color: '#3a3a3a' },
    { id: 'walnut', name: 'Walnut', color: '#6b4f3b' }
  ];

  const labelStyles = [
    { id: 'wood', name: 'Wood (Classic)' },
    { id: 'brass', name: 'Brass' },
    { id: 'silver', name: 'Silver' },
    { id: 'minimal', name: 'Minimal' }
  ];

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
            <h3 className="font-bold text-lg flex items-center gap-2 text-black dark:text-white">
              Customize Shelf
            </h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black/60 dark:text-white/60">
              <X size={18} />
            </button>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-black dark:text-white mb-3">Wood Material</h4>
              <div className="grid grid-cols-5 gap-3">
                {woodTypes.map(wood => (
                  <button
                    key={wood.id}
                    onClick={() => setWoodType(wood.id as any)}
                    className={`flex flex-col items-center gap-2 group outline-none`}
                  >
                    <div 
                      className={`w-12 h-12 rounded-full shadow-inner flex items-center justify-center transition-all ${woodType === wood.id ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#1f1f1f] scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: wood.color }}
                    >
                      {woodType === wood.id && <Check size={16} className={wood.id === 'pine' ? 'text-black/60' : 'text-white/80'} />}
                    </div>
                    <span className="text-xs text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white transition-colors">{wood.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-black dark:text-white mb-3">Label Style</h4>
              <div className="grid grid-cols-2 gap-3">
                {labelStyles.map(label => (
                  <button
                    key={label.id}
                    onClick={() => setLabelStyle(label.id as any)}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${labelStyle === label.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave({ woodType, labelStyle })}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
