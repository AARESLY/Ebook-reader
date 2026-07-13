/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Book, FileUp, Plus, Trash2, Search, Clock, Edit2, Layers, Star, Tag, Download, LayoutGrid, List, ArrowDownAZ, Settings } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import ePub from 'epubjs';
import Reader from './components/Reader';
import ExpandedBookModal from './components/ExpandedBookModal';
import TagsModal from './components/TagsModal';
import ShelfCustomizeModal, { ShelfStyle } from './components/ShelfCustomizeModal';
import { BarChart2 } from 'lucide-react';
import ReadingDashboard from './components/dashboard/ReadingDashboard';

export default function App() {
  interface LibraryBook {
    id: string;
    file: File;
    title: string;
    coverUrl: string | null;
    coverBlob?: Blob | null;
    author?: string;
    dateAdded: number;
    lastOpened?: number;
    shelfId?: string;
    totalReadTime?: number;
    isFavorite?: boolean;
    progress?: number;
    tags?: string[];
    estimatedReadingTime?: number; // in minutes
  }
  interface LibraryShelf {
    id: string;
    name: string;
    woodType?: 'oak' | 'mahogany' | 'pine' | 'ebony' | 'walnut';
    labelStyle?: 'wood' | 'brass' | 'silver' | 'minimal';
  }
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [activeBook, setActiveBook] = useState<LibraryBook | null>(null);
  const [activeBookLocation, setActiveBookLocation] = useState<string | undefined>(undefined);
  const [modalBook, setModalBook] = useState<LibraryBook | null>(null);
  const [tagModalBook, setTagModalBook] = useState<LibraryBook | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'date' | 'manual' | 'author'>('manual');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [shelves, setShelves] = useState<LibraryShelf[]>([{id: 'default', name: 'My Library'}]);
  const [customizeShelfId, setCustomizeShelfId] = useState<string | null>(null);
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [contextMenuBook, setContextMenuBook] = useState<{book: LibraryBook, x: number, y: number} | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollContainerRef });
  const bookParallaxY = useTransform(scrollY, [0, 1000], [0, 50]);

  useEffect(() => {
    import('idb-keyval').then(({ get }) => {
      Promise.all([
        get('library-books'),
        get('library-shelves')
      ]).then(([storedBooks, storedShelves]) => {
        if (storedShelves && storedShelves.length > 0) {
          setShelves(storedShelves);
        }
        if (storedBooks) {
          const loadedBooks = storedBooks.map((b: LibraryBook) => {
            if (b.coverBlob) {
              b.coverUrl = URL.createObjectURL(b.coverBlob);
            }
            return b;
          });
          setBooks(loadedBooks);
        }
        setIsLoaded(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    import('idb-keyval').then(({ set }) => {
      set('library-books', books);
      set('library-shelves', shelves);
    });
  }, [books, shelves, isLoaded]);

  useEffect(() => {
    const handleClick = () => setContextMenuBook(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, book: LibraryBook) => {
    e.preventDefault();
    setContextMenuBook({ book, x: e.clientX, y: e.clientY });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);


  const processBook = async (file: File, targetShelfId: string = 'default') => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        const book = ePub(arrayBuffer);
        await book.ready;
        const metadata = await book.loaded.metadata;
        const title = metadata.title || file.name.replace(/\.epub$/i, '');
        const author = metadata.creator || undefined;
        let coverUrl = null;
        let coverBlob = null;
        try {
          coverUrl = await book.coverUrl();
          if (coverUrl) {
            const res = await fetch(coverUrl);
            coverBlob = await res.blob();
          }
        } catch (err) {
          console.error('Failed to load cover:', err);
        }
        
        let estimatedReadingTime = undefined;
        // Basic estimation: 1MB epub ~ 300 pages ~ 375 minutes reading time (assuming ~250 words/page, ~200 wpm)
        // If metadata has word count, use it, else fallback to size estimation
        const estimatedPages = Math.max(10, Math.ceil((file.size / 1024 / 1024) * 300));
        estimatedReadingTime = Math.ceil(estimatedPages * 1.25);

        setBooks(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          file,
          title,
          author,
          coverUrl,
          coverBlob,
          dateAdded: Date.now(),
          shelfId: targetShelfId,
          estimatedReadingTime
        }]);
      } catch (err) {
        console.error('Failed to parse EPUB:', err);
        alert('Invalid or corrupted EPUB file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBooks(prev => prev.map(b => b.id === id ? { ...b, isFavorite: !b.isFavorite } : b));
    setContextMenuBook(null);
  };

  const handleRemoveBook = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this book from your library?')) {
      setBooks(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.endsWith('.epub')) {
      processBook(selected);
    } else if (selected) {
      alert('Please select an EPUB file.');
    }
  };

  const handleOpenBook = (book: LibraryBook) => {
    setModalBook(book);
  };

  const handleDragStart = (e: React.DragEvent, bookId: string) => {
    e.dataTransfer.setData('text/plain', bookId);
    setDraggedBookId(bookId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnBook = (e: React.DragEvent, targetBookId: string, targetShelfId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceBookId = e.dataTransfer.getData('text/plain');
    if (!sourceBookId || sourceBookId === targetBookId) return;

    setSortBy('manual');
    setBooks(prev => {
      const newBooks = [...prev];
      const sourceIndex = newBooks.findIndex(b => b.id === sourceBookId);
      if (sourceIndex === -1) return prev;
      
      const sourceBook = newBooks[sourceIndex];
      sourceBook.shelfId = targetShelfId;
      
      newBooks.splice(sourceIndex, 1);
      
      const targetIndex = newBooks.findIndex(b => b.id === targetBookId);
      newBooks.splice(targetIndex, 0, sourceBook);
      
      return newBooks;
    });
    setDraggedBookId(null);
  };

  const handleDropOnShelf = (e: React.DragEvent, shelfId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if files are being dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.name.endsWith('.epub')) {
        processBook(dropped, shelfId);
      } else if (dropped) {
        alert('Please drop an EPUB file.');
      }
      return;
    }

    const sourceBookId = e.dataTransfer.getData('text/plain');
    if (!sourceBookId || !draggedBookId) return;
    
    setBooks(prev => {
      const newBooks = [...prev];
      const sourceIndex = newBooks.findIndex(b => b.id === sourceBookId);
      if (sourceIndex === -1) return prev;
      
      const sourceBook = newBooks[sourceIndex];
      sourceBook.shelfId = shelfId;
      
      newBooks.splice(sourceIndex, 1);
      newBooks.push(sourceBook);
      
      return newBooks;
    });
    setDraggedBookId(null);
  };

  const addShelf = () => {
    const newId = Date.now().toString();
    setShelves(prev => [...prev, { id: newId, name: 'New Category' }]);
    setEditingShelfId(newId);
    setEditingShelfName('New Category');
  };

  const saveShelfName = () => {
    if (editingShelfId) {
      setShelves(prev => prev.map(s => s.id === editingShelfId ? { ...s, name: editingShelfName } : s));
    }
    setEditingShelfId(null);
  };

  const deleteShelf = (id: string) => {
    if (shelves.length === 1) return; // Don't delete the last shelf
    setShelves(prev => prev.filter(s => s.id !== id));
    // Move books to the first available shelf
    const firstShelfId = shelves.find(s => s.id !== id)?.id || 'default';
    setBooks(prev => prev.map(b => b.shelfId === id ? { ...b, shelfId: firstShelfId } : b));
  };

  const exportBackup = () => {
    const backupData = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      dateAdded: book.dateAdded,
      lastOpened: book.lastOpened,
      shelfId: book.shelfId,
      totalReadTime: book.totalReadTime,
      isFavorite: book.isFavorite,
      progress: book.progress,
      tags: book.tags,
      estimatedReadingTime: book.estimatedReadingTime,
      fileName: book.file.name,
      fileSize: book.file.size
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ books: backupData, shelves }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `library_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.epub')) {
      processBook(dropped);
    } else if (dropped) {
      alert('Please drop an EPUB file.');
    }
  };

  const recentlyRead = useMemo(() => {
    return [...books]
      .filter(b => b.lastOpened)
      .sort((a, b) => b.lastOpened! - a.lastOpened!)
      .slice(0, 3);
  }, [books]);

  const processedBooks = useMemo(() => {
    let result = books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      result.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    } else {
      result.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    }
    return result;
  }, [books, searchQuery, sortBy]);

  if (activeBook) {
    return <Reader 
      file={activeBook.file} 
      initialLocation={activeBookLocation}
      onAutoSave={(progress) => {
        setBooks(prev => prev.map(b => b.id === activeBook.id ? { 
          ...b, 
          lastOpened: Date.now(),
          progress: progress
        } : b));
      }}
      onClose={(durationMs, progress) => {
        setBooks(prev => prev.map(b => b.id === activeBook.id ? { 
          ...b, 
          lastOpened: Date.now(),
          totalReadTime: (b.totalReadTime || 0) + durationMs,
          progress: progress ?? b.progress
        } : b));
        setActiveBook(null);
        setActiveBookLocation(undefined);
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 2500);
      }} 
    />;
  }


const woodThemes: Record<string, { top: string, front: string, lines: string, bottom: string }> = {
    oak: { top: '#d49964', front: '#e6b07c', lines: '#8c5226', bottom: '#6b3c18' },
    mahogany: { top: '#8b2525', front: '#a53636', lines: '#5a1010', bottom: '#3a0a0a' },
    pine: { top: '#e6ccab', front: '#f2dcbf', lines: '#c29d6d', bottom: '#a88559' },
    ebony: { top: '#3a3a3a', front: '#4a4a4a', lines: '#1f1f1f', bottom: '#111111' },
    walnut: { top: '#6b4f3b', front: '#80614a', lines: '#473124', bottom: '#302016' }
};

const getLabelStyle = (styleType: string, baseWoodColor: string, baseWoodBorder: string) => {
    switch (styleType) {
        case 'brass': return { bg: 'bg-gradient-to-r from-[#d4af37] to-[#aa8022]', border: 'border-[#b5a642]', text: 'text-[#2c2005]', shadow: 'shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.8)]' };
        case 'silver': return { bg: 'bg-gradient-to-r from-[#e0e0e0] to-[#b0b0b0]', border: 'border-[#999]', text: 'text-[#111]', shadow: 'shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.8)]' };
        case 'minimal': return { bg: 'bg-transparent', border: 'border-b border-white/20', text: 'text-white', shadow: 'shadow-none' };
        default: return { bg: `bg-[${baseWoodColor}]`, border: `border-2 border-[${baseWoodBorder}]`, text: 'text-[#f4ebd0]', shadow: 'shadow-md inset-shadow' };
    }
};

const renderWoodenShelf = (shelfBooks: LibraryBook[], key: string | number, shelfInfo?: { id: string; name: string; isFirst: boolean, woodType?: string, labelStyle?: string }) => {
  const woodTheme = woodThemes[shelfInfo?.woodType || 'oak'];
  const labelStyleInfo = getLabelStyle(shelfInfo?.labelStyle || 'wood', woodTheme.lines, woodTheme.bottom);
  
  return (
  <motion.div layout key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
       className="w-full relative h-[240px] flex flex-col justify-end shrink-0"
       onDragOver={handleDragOver}
       onDrop={(e) => shelfInfo ? handleDropOnShelf(e, shelfInfo.id) : undefined}
  >
    {/* Shelf backdrop shadow */}
    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

    {shelfInfo && shelfInfo.isFirst && (
      <div className="absolute top-4 left-6 md:left-16 z-20 flex items-center justify-center pointer-events-auto">
        {editingShelfId === shelfInfo.id ? (
          <div className="flex items-center gap-2 bg-[#8c5226] border-2 border-[#5c3111] rounded shadow-md px-2 py-1">
             <input 
               autoFocus
               type="text" 
               value={editingShelfName} 
               onChange={e => setEditingShelfName(e.target.value)}
               onBlur={saveShelfName}
               onKeyDown={e => e.key === 'Enter' && saveShelfName()}
               className="bg-transparent text-[#f4ebd0] text-xs font-serif font-bold tracking-wider uppercase outline-none w-32"
             />
          </div>
        ) : (
          <div className={`group/label px-4 py-1.5 rounded flex items-center gap-2 cursor-pointer transition-colors ${labelStyleInfo.bg} ${labelStyleInfo.border} ${labelStyleInfo.shadow}`}
               style={shelfInfo?.labelStyle === 'wood' || !shelfInfo?.labelStyle ? { boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)', backgroundColor: woodTheme.lines, borderColor: woodTheme.bottom } : {}}
               onClick={() => { setEditingShelfId(shelfInfo.id); setEditingShelfName(shelfInfo.name); }}
          >
            <span className={`text-[10px] sm:text-xs font-serif font-bold tracking-wider uppercase ${labelStyleInfo.text}`} style={{ textShadow: (shelfInfo?.labelStyle === 'wood' || !shelfInfo?.labelStyle) ? '0 -1px 0 rgba(0,0,0,0.5)' : 'none' }}>
              {shelfInfo.name}
            </span>
            <Edit2 size={10} className={`opacity-0 group-hover/label:opacity-100 transition-opacity ${labelStyleInfo.text}`} />
            
            <button onClick={(e) => { e.stopPropagation(); setCustomizeShelfId(shelfInfo.id); }} className={`ml-1 opacity-0 group-hover/label:opacity-100 transition-opacity ${labelStyleInfo.text} hover:scale-110`}>
              <Settings size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteShelf(shelfInfo.id); }} className={`ml-2 hover:text-red-400 opacity-0 group-hover/label:opacity-100 transition-opacity ${labelStyleInfo.text}`}>
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    )}
    
    {!shelfInfo && (
      <div className="absolute top-8 left-6 md:left-16 z-0 flex items-center justify-center pointer-events-auto">
        <div className="px-4 py-1.5 bg-[#8c5226] border-2 border-[#5c3111] rounded shadow-md flex items-center gap-2" style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)'}}>
          <Clock size={12} className="text-[#f4ebd0]" />
          <span className="text-[#f4ebd0] text-[10px] sm:text-xs font-serif font-bold tracking-wider uppercase" style={{ textShadow: '0 -1px 0 rgba(0,0,0,0.5)' }}>
            Recently Read
          </span>
        </div>
      </div>
    )}

    {/* Books on this shelf */}
    <motion.div style={{ y: bookParallaxY }} className="absolute bottom-[22px] left-0 right-0 px-6 md:px-16 flex items-end justify-start gap-6 sm:gap-10 md:gap-16 z-10 w-full">
      <AnimatePresence>
      {shelfBooks.map(book => (
        <motion.div 
          layout
          layoutId={book.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
          key={book.id} 
          className={`relative group cursor-pointer pointer-events-auto flex flex-col items-center ${draggedBookId === book.id ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, book.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => shelfInfo ? handleDropOnBook(e, book.id, shelfInfo.id) : undefined}
          onClick={() => handleOpenBook(book)}
          onContextMenu={(e) => handleContextMenu(e, book)}
        >
          <div className="w-20 sm:w-24 md:w-32 aspect-[2/3] bg-white rounded-r-sm rounded-l shadow-[5px_5px_15px_rgba(0,0,0,0.5)] overflow-hidden transition-transform transform hover:-translate-y-2 hover:scale-105 flex items-center justify-center text-center p-0 relative border-l-2 border-black/20">
              {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover pointer-events-none" />
              ) : (
                  <div className="w-full h-full bg-[#8c5226] flex items-center justify-center border-4 border-[#6e3c16] p-2 pointer-events-none">
                      <span className="text-xs font-serif text-[#f4ebd0] line-clamp-4 pointer-events-none">{book.title}</span>
                  </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
              {book.progress !== undefined && book.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 pointer-events-none">
                  <div className="h-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" style={{ width: `${book.progress * 100}%` }} />
                </div>
              )}
              {book.isFavorite && (
                <div className="absolute top-1 left-3 z-20 drop-shadow-md pointer-events-none">
                  <Star size={14} className="fill-yellow-400 text-yellow-500" />
                </div>
              )}
              {book.tags && book.tags.length > 0 && (
                <div className="absolute top-1 left-[28px] z-20 drop-shadow-md pointer-events-none text-blue-400">
                  <Tag size={12} className="fill-blue-400/20" />
                </div>
              )}
              <button 
                  onClick={(e) => handleRemoveBook(e, book.id)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
                  title="Remove book"
              >
                  <Trash2 size={12} />
              </button>
          </div>
          {/* Name below book */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-40 text-center flex justify-center z-20 pointer-events-none">
            <span className="text-[#2e1808] text-[10px] sm:text-xs font-bold px-1 line-clamp-1 max-w-full truncate mix-blend-color-burn" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.2)'}}>
              {book.title}
            </span>
          </div>
        </motion.div>
      ))}
      </AnimatePresence>
    </motion.div>
    
    <div className="relative w-full h-8 z-0 flex flex-col">
        <div className="absolute top-8 left-0 right-0 h-16 bg-black/60 blur-lg pointer-events-none z-[-1]" />
        <div 
          className="w-full h-2 relative border-t border-white/20"
          style={{ backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(0,0,0,0.2))`, backgroundColor: woodTheme.top }}
        ></div>
        <div className="w-full h-6 relative overflow-hidden flex flex-col justify-between shadow-[inset_0_-2px_5px_rgba(0,0,0,0.3)]" style={{ backgroundColor: woodTheme.front }}>
            <div className="w-full h-[1px] bg-white/50" />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 30px, ${woodTheme.lines} 30px, ${woodTheme.lines} 33px)` }} />
            <div className="w-full h-[2px]" style={{ backgroundColor: woodTheme.bottom }} />
        </div>
    </div>
  </motion.div>
)};

  return (
    <div className="flex h-screen w-full flex-col bg-[#121212] font-sans text-gray-200">
      <div className="h-14 flex items-center px-4 w-full border-b border-white/5 bg-[#1a1a1a] justify-between z-20 relative">
        <div className="flex items-center gap-4">
          <div className="text-white/50 text-xs font-semibold tracking-widest uppercase">EPUB Reader</div>
        </div>
        
        <div className="flex items-center gap-4 flex-1 max-w-md px-4 sm:px-8">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search library..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'title' | 'date' | 'manual' | 'author')}
            className="bg-[#2a2a2a] border border-white/10 rounded-md py-1.5 px-3 text-xs text-white/80 focus:outline-none focus:border-white/20 cursor-pointer appearance-none outline-none"
          >
            <option value="manual">Manual</option>
            <option value="date">Date Added</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
          </select>
          <button
            onClick={() => setSortBy(sortBy === 'title' ? 'date' : 'title')}
            className="flex items-center gap-1.5 bg-[#2a2a2a] border border-white/10 rounded-md py-1.5 px-3 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors outline-none shrink-0"
            title={`Sort by ${sortBy === 'title' ? 'Date' : 'Title'}`}
          >
            {sortBy === 'title' ? <Clock size={14} /> : <ArrowDownAZ size={14} />}
          </button>
        </div>

        <button 
          onClick={addShelf}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 text-white/60 hover:text-white transition-colors text-xs font-medium shrink-0"
        >
          <Layers size={14} />
          Add Shelf
        </button>
        <button 
          onClick={() => setIsDashboardOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 text-white/60 hover:text-white transition-colors text-xs font-medium shrink-0"
        >
          <BarChart2 size={14} />
          Dashboard
        </button>
        <button 
          onClick={exportBackup}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 text-white/60 hover:text-white transition-colors text-xs font-medium shrink-0"
        >
          <Download size={14} />
          Export Backup
        </button>
        <div className="flex bg-black/20 rounded-md p-0.5 ml-2">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-1 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
          >
            <List size={14} />
          </button>
        </div>
      </div>
      <ReadingDashboard isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />
                              <div ref={scrollContainerRef} className="flex-1 relative overflow-y-auto overflow-x-hidden" style={{ backgroundColor: '#a66a38' }}>
        {/* Wood panels background */}
        <div 
          className="fixed inset-0 z-0 pointer-events-none" 
          style={{
              backgroundImage: `
                  repeating-linear-gradient(90deg, 
                      rgba(0,0,0,0.03) 0px, 
                      rgba(0,0,0,0.03) 2px, 
                      transparent 2px, 
                      transparent 80px
                  ),
                  repeating-linear-gradient(90deg, 
                      rgba(255,255,255,0.02) 0px, 
                      rgba(255,255,255,0.02) 1px, 
                      transparent 1px, 
                      transparent 120px
                  )
              `,
              backgroundSize: '80px 100%, 120px 100%'
          }} 
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
        </div>

        
        {/* Shelves */}
        {viewMode === 'list' ? (
          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 pb-32">
            <div className="flex flex-col gap-2">
              {processedBooks.map(book => (
                <div 
                  key={book.id}
                  onClick={() => handleOpenBook(book)}
                  onContextMenu={(e) => handleContextMenu(e, book)}
                  className="bg-[#2a2a2a]/90 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors p-3 rounded-lg flex items-center gap-4 cursor-pointer pointer-events-auto"
                >
                  <div className="w-12 h-16 bg-[#1a1a1a] rounded overflow-hidden shrink-0 border border-white/5">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#8c5226] flex items-center justify-center">
                        <Book size={16} className="text-white/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">{book.title}</h3>
                    {book.author && <p className="text-white/50 text-xs truncate mt-0.5">{book.author}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {book.progress !== undefined && book.progress > 0 && (
                        <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${book.progress * 100}%` }} />
                        </div>
                      )}
                      {book.estimatedReadingTime !== undefined && (
                        <div className="flex items-center gap-1 text-white/40 text-[10px]">
                          <Clock size={10} />
                          {Math.floor(book.estimatedReadingTime / 60)}h {book.estimatedReadingTime % 60}m
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     {book.isFavorite && <Star size={14} className="fill-yellow-400 text-yellow-500" />}
                     {book.tags && book.tags.length > 0 && <Tag size={14} className="text-blue-400" />}
                     <button 
                       onClick={(e) => { e.stopPropagation(); handleRemoveBook(e, book.id); }}
                       className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                     >
                       <Trash2 size={16} />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative z-0 flex flex-col min-h-full justify-start pointer-events-none pb-32 pt-[10px]">
            {recentlyRead.length > 0 && renderWoodenShelf(recentlyRead, 'recent')}
            
            {shelves.map(shelf => {
               const shelfBooks = processedBooks.filter(b => b.shelfId === shelf.id || (!b.shelfId && shelf.id === 'default'));
               const shelfCount = Math.max(1, Math.ceil(shelfBooks.length / 5));
               
               return Array.from({length: shelfCount}).map((_, i) => 
                 renderWoodenShelf(shelfBooks.slice(i * 5, (i + 1) * 5), `${shelf.id}-${i}`, { id: shelf.id, name: shelf.name, isFirst: i === 0, woodType: shelf.woodType, labelStyle: shelf.labelStyle })
               );
            })}
          </div>
        )}
{/* Overlay shadow to give depth to the whole bookcase */}
        <div className="fixed inset-0 z-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.5)]" />

        {/* Library Content */}
        <div className="absolute top-0 left-0 right-0 z-10 w-full p-8 flex justify-center pb-24 pointer-events-none min-h-full items-center">
          <input 
            type="file" 
            accept=".epub" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          {books.length === 0 ? (
            <div 
                className="w-full max-w-md p-10 rounded-2xl bg-[#1E1E1E]/95 backdrop-blur-xl border border-white/20 shadow-2xl flex flex-col items-center justify-center text-center transition-all hover:bg-[#252525] pointer-events-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <div className="mb-6 relative flex items-center justify-center">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
                    <circle cx="60" cy="60" r="50" fill="url(#glowGradient)" opacity="0.15" />
                    <path d="M40 75C40 75 45 70 60 70C75 70 80 75 80 75V45C80 45 75 40 60 40C45 40 40 45 40 45V75Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8"/>
                    <path d="M60 40V70" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                    <path d="M45 50H55" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
                    <path d="M45 58H55" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
                    <path d="M65 50H75" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
                    <path d="M65 58H75" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
                    <circle cx="35" cy="30" r="1.5" fill="white" opacity="0.6" className="animate-pulse" />
                    <circle cx="85" cy="25" r="2" fill="white" opacity="0.4" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <circle cx="75" cy="85" r="1" fill="white" opacity="0.5" className="animate-pulse" style={{ animationDelay: '1s' }} />
                    <path d="M58 20L60 15L62 20L67 22L62 24L60 29L58 24L53 22L58 20Z" fill="white" opacity="0.8" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <defs>
                      <radialGradient id="glowGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 60) rotate(90) scale(50)">
                        <stop stopColor="white" />
                        <stop offset="1" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
                <h1 className="text-3xl font-light text-white mb-2 tracking-tight" style={{fontFamily: 'Georgia, serif'}}>Library</h1>
                <p className="text-sm text-white/50 mb-8 max-w-[250px]">
                Drag and drop an EPUB file here to start reading.
                </p>
                
                <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 bg-white/5 text-sm font-bold text-white/90 hover:bg-white/10 hover:border-white/30 shadow-lg transition-all focus:outline-none"
                >
                <FileUp size={16} />
                Select EPUB File
                </button>
            </div>
          ) : (
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="fixed bottom-8 right-8 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105 z-50 group border border-white/10 pointer-events-auto"
                title="Add Book"
            >
                <Plus size={24} />
                <span className="absolute right-16 bg-black/80 text-white text-xs font-semibold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 whitespace-nowrap pointer-events-none">
                    Add Book
                </span>
            </button>
          )}
        </div>
      </div>

        {/* Context Menu / Book Details */}
        {contextMenuBook && (
          <div 
            className="fixed z-[100] bg-[#2a2a2a] border border-white/10 rounded-lg shadow-2xl p-4 min-w-[250px] pointer-events-auto animate-slide-in"
            style={{ 
              top: Math.min(contextMenuBook.y, window.innerHeight - 150), 
              left: Math.min(contextMenuBook.x, window.innerWidth - 250) 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-2">{contextMenuBook.book.title}</h3>
            {contextMenuBook.book.author && <p className="text-white/70 text-xs mb-3 italic">{contextMenuBook.book.author}</p>}
            <button
              onClick={(e) => toggleFavorite(e, contextMenuBook.book.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-white/90 transition-colors text-xs font-medium mb-3 mt-1"
            >
              <Star size={14} className={contextMenuBook.book.isFavorite ? "fill-yellow-400 text-yellow-500" : ""} />
              {contextMenuBook.book.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            </button>
            <button
              onClick={() => { setTagModalBook(contextMenuBook.book); setContextMenuBook(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-white/90 transition-colors text-xs font-medium mb-3 mt-1"
            >
              <Tag size={14} />
              Manage Tags
            </button>
            <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-white/10">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Added</span>
              <span className="text-white/90 text-xs">{new Date(contextMenuBook.book.dateAdded).toLocaleDateString()} at {new Date(contextMenuBook.book.dateAdded).toLocaleTimeString()}</span>
            </div>
            {contextMenuBook.book.lastOpened && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-white/50 text-[10px] uppercase tracking-wider">Last Opened</span>
                <span className="text-white/90 text-xs">{new Date(contextMenuBook.book.lastOpened).toLocaleDateString()} at {new Date(contextMenuBook.book.lastOpened).toLocaleTimeString()}</span>
              </div>
            )}
            {contextMenuBook.book.totalReadTime !== undefined && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-white/50 text-[10px] uppercase tracking-wider">Total Read Time</span>
                <span className="text-white/90 text-xs">
                  {Math.floor(contextMenuBook.book.totalReadTime / 60000)} min {Math.floor((contextMenuBook.book.totalReadTime % 60000) / 1000)} sec
                </span>
              </div>
            )}
            {contextMenuBook.book.estimatedReadingTime !== undefined && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-white/50 text-[10px] uppercase tracking-wider">Est. Reading Time</span>
                <span className="text-white/90 text-xs flex items-center gap-1">
                  <Clock size={10} />
                  {Math.floor(contextMenuBook.book.estimatedReadingTime / 60)}h {contextMenuBook.book.estimatedReadingTime % 60}m
                </span>
              </div>
            )}
          </div>
        )}

        {customizeShelfId && (
          <ShelfCustomizeModal
            shelf={shelves.find(s => s.id === customizeShelfId)}
            onClose={() => setCustomizeShelfId(null)}
            onSave={(style) => {
              setShelves(prev => prev.map(s => s.id === customizeShelfId ? { ...s, ...style } : s));
              setCustomizeShelfId(null);
            }}
          />
        )}

        {modalBook && (
          <ExpandedBookModal 
            book={modalBook} 
            onClose={() => setModalBook(null)} 
            onOpen={(loc) => {
              setBooks(prev => prev.map(b => b.id === modalBook.id ? { ...b, lastOpened: Date.now() } : b));
              setActiveBookLocation(loc);
              setActiveBook(modalBook);
              setModalBook(null);
            }} 
          />
        )}
        
        {tagModalBook && (
          <TagsModal
            book={tagModalBook}
            onClose={() => setTagModalBook(null)}
            onSave={(tags) => {
              setBooks(prev => prev.map(b => b.id === tagModalBook.id ? { ...b, tags } : b));
              setTagModalBook(null);
            }}
          />
        )}
        
        <AnimatePresence>
          {isSyncing && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-[200] font-medium"
            >
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Auto-syncing...</span>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
