import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag as TagIcon, Plus } from 'lucide-react';

export default function TagsModal({ book, onClose, onSave }: { book: any, onClose: () => void, onSave: (tags: string[]) => void }) {
  const [tags, setTags] = useState<string[]>(book.tags || []);
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const newTag = inputValue.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

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
              <TagIcon size={18} /> Manage Tags
            </h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black/60 dark:text-white/60">
              <X size={18} />
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            <p className="text-sm text-black/60 dark:text-white/60 mb-4 line-clamp-1">
              Editing tags for: <span className="font-semibold">{book.title}</span>
            </p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                placeholder="Add a tag..."
                className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-blue-500"
              />
              <button 
                onClick={handleAddTag}
                className="bg-black dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg flex items-center justify-center hover:bg-black/80 dark:hover:bg-white/80 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <div key={tag} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full text-sm font-medium">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-black/40 dark:text-white/40 italic w-full text-center py-4">No tags added yet.</p>
              )}
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
              onClick={() => onSave(tags)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Save Tags
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
