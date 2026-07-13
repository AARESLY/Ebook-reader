import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, Play, Info, List, Clock } from 'lucide-react';
import ePub from 'epubjs';

export default function ExpandedBookModal({ book, onClose, onOpen }: { book: any, onClose: () => void, onOpen: (loc?: string) => void }) {
  const [description, setDescription] = useState<string>('');
  const [toc, setToc] = useState<any[]>([]);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const loadBookDetails = async () => {
      try {
        const p = localStorage.getItem(`epub_progress_${book.file.name}_${book.file.size}`);
        if (p) setProgress(parseFloat(p));

        const epubBook = ePub(book.file);
        await epubBook.ready;
        const metadata = await epubBook.loaded.metadata;
        if (isMounted) setDescription(metadata.description || 'No description available.');
        
        const navigation = await epubBook.loaded.navigation;
        if (isMounted && navigation) setToc(navigation.toc || []);
      } catch (err) {
        console.error("Failed to load book details", err);
      }
    };
    loadBookDetails();
    return () => { isMounted = false; };
  }, [book]);

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Cover Section */}
          <div className="w-full md:w-1/3 bg-gray-100 dark:bg-black/20 p-8 flex flex-col items-center justify-center relative border-r border-black/5 dark:border-white/5">
            <div className="w-48 aspect-[2/3] shadow-2xl rounded-sm overflow-hidden mb-6 relative">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#8c5226] flex items-center justify-center border-4 border-[#6e3c16] p-4">
                  <span className="text-sm font-serif text-[#f4ebd0] text-center line-clamp-4">{book.title}</span>
                </div>
              )}
            </div>
            <button 
              onClick={() => onOpen()}
              className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium shadow-md hover:bg-black/80 dark:hover:bg-white/80 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen size={18} />
              Read Now
            </button>
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-black/60 dark:text-white/60 mb-1">
                <span>Reading Progress</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
            {book.estimatedReadingTime && (
              <div className="w-full mt-4 text-center">
                <span className="text-xs text-black/50 dark:text-white/50 flex items-center justify-center gap-1">
                  <Clock size={12} />
                  Est. Reading Time: {Math.floor(book.estimatedReadingTime / 60)}h {book.estimatedReadingTime % 60}m
                </span>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="w-full md:w-2/3 p-8 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-serif font-bold text-black dark:text-white mb-2">{book.title}</h2>
                {book.author && <p className="text-lg text-black/60 dark:text-white/60">{book.author}</p>}
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-3 text-black/80 dark:text-white/80 font-semibold border-b border-black/10 dark:border-white/10 pb-2">
                  <Info size={18} />
                  <h3>Summary</h3>
                </div>
                <div 
                  className="text-black/70 dark:text-white/70 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </section>

              {toc && toc.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 text-black/80 dark:text-white/80 font-semibold border-b border-black/10 dark:border-white/10 pb-2">
                    <List size={18} />
                    <h3>Chapters</h3>
                  </div>
                  <div className="space-y-2">
                    {toc.slice(0, 10).map((item: any, i: number) => (
                      <button 
                        key={i} 
                        onClick={() => onOpen(item.href)}
                        className="w-full flex justify-between items-center p-3 rounded-lg bg-black/5 dark:bg-white/5 text-sm hover:bg-black/10 dark:bg-white/10 transition-colors text-left"
                      >
                        <span className="text-black/80 dark:text-white/80 truncate pr-4">{item.label}</span>
                      </button>
                    ))}
                    {toc.length > 10 && (
                      <div className="text-xs text-center text-black/50 dark:text-white/50 pt-2">
                        + {toc.length - 10} more chapters
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
