import BookEngine from "../flipbook/BookEngine";
import { useDrag } from "@use-gesture/react";
import html2canvas from "html2canvas";

import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition, Location } from 'epubjs';
import { trackReadingMinute, trackChapterCompleted } from '../lib/stats';
import { motion, AnimatePresence } from 'motion/react';
import ReadingDashboard from './dashboard/ReadingDashboard';
import { Share2, Headphones, Upload, LayoutGrid, Quote, ChevronLeft, ChevronRight, Menu, Settings, X, BookOpen, Book as BookIcon, Bookmark, Type, Minus, Plus, Search, BarChart2, Target, Flame, Play, Pause, Keyboard, Maximize, Minimize, Edit3, Download, Clock, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ReaderProps {
  file: File;
  onClose: (durationMs: number, progress?: number) => void;
  initialLocation?: string;
  onAutoSave?: (progress: number) => void;
}

interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

interface BookmarkItem {
  cfi: string;
  label: string;
  percentage: number;
}

interface SearchResult {
  cfi: string;
  excerpt: string;
}

interface NoteItem {
  id: string;
  cfiRange: string;
  excerpt: string;
  note: string;
}

const mockStatsData = [
  { day: 'Mon', hours: 1.2 },
  { day: 'Tue', hours: 0.8 },
  { day: 'Wed', hours: 1.5 },
  { day: 'Thu', hours: 2.1 },
  { day: 'Fri', hours: 0.5 },
  { day: 'Sat', hours: 3.2 },
  { day: 'Sun', hours: 2.8 },
];

const ShortcutRow = ({ keys, desc }: { keys: string[], desc: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-black/5 dark:border-white/5 last:border-0">
    <span className="text-sm text-black/70 dark:text-white/70">{desc}</span>
    <div className="flex gap-1">
      {keys.map(k => (
        <kbd key={k} className="px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-xs font-mono text-black/90 dark:text-white/90 border border-black/20 dark:border-white/20">{k}</kbd>
      ))}
    </div>
  </div>
);

export default function Reader({ file, onClose, initialLocation, onAutoSave }: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const bookEngine = useRef<BookEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [location, setLocation] = useState<string | number>('');
  const [progress, setProgress] = useState(0);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const prevProgressRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onAutoSave && progress > 0) {
        onAutoSave(progress);
      }
    }, 2000);
    return () => clearTimeout(handler);
  }, [progress, onAutoSave]);

  useEffect(() => {
    if (prevProgressRef.current !== null) {
      const prev = prevProgressRef.current;
      const current = progress;
      
      if (current > prev && (current - prev) < 0.1) {
        const milestones = [25, 50, 75, 100];
        for (const m of milestones) {
          const mVal = m / 100;
          if (prev < mVal && current >= mVal) {
            setMilestoneMessage(`🎉 You've reached ${m}% of the book!`);
            setTimeout(() => setMilestoneMessage(null), 4000);
          }
        }
      }
    }
    prevProgressRef.current = progress;
  }, [progress]);

  const [totalPages, setTotalPages] = useState(0);
  const [minsLeft, setMinsLeft] = useState<number | null>(null);
  const [pageTransition, setPageTransition] = useState<'next' | 'prev' | 'chapter' | 'none'>('none');
  const [curlAnimating, setCurlAnimating] = useState(false);
  const [flipState, setFlipState] = useState<'idle' | 'flipping-out' | 'flipping-in'>('idle');
  const [curlDirection, setCurlDirection] = useState<'next' | 'prev'>('next');
  const [pageTextureUrl, setPageTextureUrl] = useState<string | null>(null);
  const [cachedTexture, setCachedTexture] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState<{x: number, y: number} | null>(null);
  const dragRef = useRef(false);
  const dragTarget = useRef({ x: 0, y: 0 });

  const bindDrag = useDrag(({ down, movement: [mx, my], xy: [px, py], cancel, first, last, args: [dir] }) => {
    if (curlAnimating && !dragRef.current) return;
    
    if (first) {
       const isNext = px > window.innerWidth / 2;
       setPageTextureUrl(cachedTexture);
       setCurlDirection(isNext ? 'next' : 'prev');
       setCurlAnimating(true);
       dragRef.current = true;
       
       // Instantly change the underlying book page so it's ready when peeled
       if (isNext) rendition?.next();
       else rendition?.prev();
    }
    
    if (down) {
       dragTarget.current = { x: px, y: py };
       setDragPointer({ x: px, y: py });
    } else if (last) {
       dragRef.current = false;
       setDragPointer(null);
       // We don't trigger next/prev or set curlAnimating(false) here.
       // PageFlipOverlay will detect dragPointer becoming null, animate to 1.0 or 0.0,
       // and fire onAnimationMidpoint / onAnimationComplete callbacks which Reader handles.
    }
  }, { filterTaps: true, threshold: 20 });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'toc' | 'bookmarks' | 'search' | 'stats' | 'notes' | 'thumbnails'>('toc');
  
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(`epub_notes_${file.name}_${file.size}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`epub_notes_${file.name}_${file.size}`, JSON.stringify(notes));
  }, [notes, file.name, file.size]);
  const [focusMode, setFocusMode] = useState(() => {
    return localStorage.getItem('reader_focus_mode') === 'true';
  });
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      if (rendition) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          try { rendition.resize('100%' as any, '100%' as any); } catch (e) {}
        }, 150);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [rendition]);

  useEffect(() => {
    localStorage.setItem('reader_focus_mode', String(focusMode));
    if (rendition) {
      const timer = setTimeout(() => {
        try { rendition.resize('100%' as any, '100%' as any); } catch (e) {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [focusMode, rendition]);
  
  const [bookTheme, setBookTheme] = useState<'light' | 'dark' | 'sepia' | 'high-contrast'>(() => {
    return (localStorage.getItem('reader_book_theme') as any) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('reader_book_theme', bookTheme);
  }, [bookTheme]);

  const [bookFont, setBookFont] = useState<string>(() => {
    return localStorage.getItem('reader_book_font') || 'Bookerly';
  });

  useEffect(() => {
    localStorage.setItem('reader_book_font', bookFont);
  }, [bookFont]);

  const [themePref, setThemePref] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('reader_theme') as 'light' | 'dark' | 'system') || 'system';
  });
  
  useEffect(() => {
    localStorage.setItem('reader_theme', themePref);
  }, [themePref]);
  
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themePref === 'system') {
        setIsDark(mediaQuery.matches);
      }
    };
    
    if (themePref === 'system') {
      setIsDark(mediaQuery.matches);
    } else {
      setIsDark(themePref === 'dark');
    }
  
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePref]);
  
  
  const [readingGoal, setReadingGoal] = useState(30);
  const [dailyReadTime, setDailyReadTime] = useState(12);
  const [streak, setStreak] = useState(3);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dictPopup, setDictPopup] = useState<{word: string, def: string, phonetic: string, x: number, y: number} | null>(null);
  const [isFetchingDef, setIsFetchingDef] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [isTwoPage, setIsTwoPage] = useState(typeof window !== 'undefined' && window.innerWidth > 768);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [syncAudio, setSyncAudio] = useState(true);

  // Sync Audio to Book Progress
  useEffect(() => {
    if (syncAudio && audioRef.current && audioDuration > 0 && book?.locations?.length() > 0) {
      const targetTime = progress * audioDuration;
      if (Math.abs(audioRef.current.currentTime - targetTime) > 10 && !isAudioPlaying) {
        audioRef.current.currentTime = targetTime;
      }
    }
  }, [progress, audioDuration, syncAudio, book, isAudioPlaying]);

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
      if (syncAudio && isAudioPlaying && audioDuration > 0 && book?.locations?.length() > 0) {
        const audioPercentage = audioRef.current.currentTime / audioDuration;
        if (Math.abs(audioPercentage - progress) > 0.02 && rendition) {
          const cfi = book.locations.cfiFromPercentage(audioPercentage);
          if (cfi) rendition.display(cfi);
        }
      }
    }
  };



  const exportNotes = () => {
    let content = `# Notes for ${file.name}\n\n`;
    notes.forEach(note => {
        content += `> "${note.excerpt}"\n\n`;
        content += `**Note:** ${note.note}\n\n`;
        content += `---\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lastMousePos = useRef({ x: 0, y: 0 });

  const toggleTTS = () => {
    if (isPlaying) {
      synthRef.current.pause();
      setIsPlaying(false);
    } else {
      if (synthRef.current.paused && utteranceRef.current) {
        synthRef.current.resume();
        setIsPlaying(true);
      } else {
        if (!rendition) return;
        const contents = rendition.getContents()[0];
        if (contents && contents.document) {
          const text = contents.document.body.innerText || contents.document.body.textContent || '';
          if (!text) return;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = playbackRate;
          utterance.onend = () => {
            setIsPlaying(false);
            utteranceRef.current = null;
          };
          utteranceRef.current = utterance;
          synthRef.current.speak(utterance);
          setIsPlaying(true);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => {
        const next = prev + 1;
        if (next % 60 === 0) {
          trackReadingMinute();
          setDailyReadTime(d => {
            const nextD = d + 1;
            if (nextD === readingGoal && d < readingGoal) {
              setStreak(s => s + 1);
            }
            return nextD;
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [readingGoal]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let readerBook: Book | null = null;
    let newRendition: Rendition | null = null;
    let isCancelled = false;

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (isCancelled) return;
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        readerBook = ePub(arrayBuffer);
        const origDestroy = readerBook.destroy.bind(readerBook);
        readerBook.destroy = () => {
          origDestroy();
          (readerBook as any).resources = { replaceCss: () => Promise.resolve() };
        };
        await readerBook.ready;
        if (isCancelled) return;
        
        try {
            
            let coverId = (readerBook.packaging.metadata as any).cover;
            let coverItemIndex = -1;
            
            // 1. Try finding by cover ID
            if (coverId && readerBook.spine && (readerBook.spine as any).spineItems) {
                coverItemIndex = (readerBook.spine as any).spineItems.findIndex((item) => item.idref === coverId || item.id === coverId);
            }
            
            // 2. Try finding by guide (reference type="cover")
            if (coverItemIndex === -1 && (readerBook.packaging as any).nav && (readerBook.packaging as any).nav.guide) {
                const coverRef = (readerBook.packaging as any).nav.guide.find((item) => item.type === 'cover');
                if (coverRef && coverRef.href) {
                     coverItemIndex = (readerBook.spine as any).spineItems.findIndex((item) => coverRef.href.includes(item.href) || item.href.includes(coverRef.href));
                }
            }
            
            // 3. Try finding by landmarks
            if (coverItemIndex === -1 && (readerBook.packaging as any).nav && (readerBook.packaging as any).nav.landmarks) {
                const coverRef = (readerBook.packaging as any).nav.landmarks.find((item) => item.type === 'cover');
                if (coverRef && coverRef.href) {
                     coverItemIndex = (readerBook.spine as any).spineItems.findIndex((item) => coverRef.href.includes(item.href) || item.href.includes(coverRef.href));
                }
            }

            if (coverItemIndex > 0) {
                const coverItem = (readerBook.spine as any).spineItems.splice(coverItemIndex, 1)[0];
                (readerBook.spine as any).spineItems.unshift(coverItem);
            }

            if (coverId && readerBook.spine && (readerBook.spine as any).spineItems) {
                const coverItemIndex = (readerBook.spine as any).spineItems.findIndex((item) => item.idref === coverId || item.id === coverId);
                if (coverItemIndex > 0) {
                    const coverItem = (readerBook.spine as any).spineItems.splice(coverItemIndex, 1)[0];
                    (readerBook.spine as any).spineItems.unshift(coverItem);
                }
            }
        } catch(e) { console.error(e); }
        setBook(readerBook);


      readerBook.loaded.navigation.then((nav) => {
        if (isCancelled) return;
        setToc(nav.toc as TocItem[]);
      });

      newRendition = readerBook.renderTo(viewerRef.current!, {
        width: '100%',
        height: '100%',
        spread: 'none',
        manager: 'default',
        flow: 'paginated'
      }); 

      console.log("viewer size", {
          width: viewerRef.current?.clientWidth,
          height: viewerRef.current?.clientHeight,
      });

      setRendition(newRendition);
      

      newRendition.themes.register("dark", {
        body: { background: 'transparent', color: '#e5e7eb', padding: '40px !important' },
        p: { 'line-height': '1.6', color: '#d1d5db' },
        h1: { color: '#ffffff' }, h2: { color: '#ffffff' }, h3: { color: '#ffffff' },
        h4: { color: '#ffffff' }, h5: { color: '#ffffff' }, h6: { color: '#ffffff' },
        a: { color: '#60a5fa' }
      });
      newRendition.themes.register("light", {
        body: { background: 'transparent', color: '#1f2937', padding: '40px !important' },
        p: { 'line-height': '1.6', color: '#374151' },
        h1: { color: '#111827' }, h2: { color: '#111827' }, h3: { color: '#111827' },
        h4: { color: '#111827' }, h5: { color: '#111827' }, h6: { color: '#111827' },
        a: { color: '#2563eb' }
      });
      newRendition.themes.register("sepia", {
        body: { background: 'transparent', color: '#5b4636', padding: '40px !important' },
        p: { 'line-height': '1.6', color: '#433422' },
        h1: { color: '#2d2315' }, h2: { color: '#2d2315' }, h3: { color: '#2d2315' },
        h4: { color: '#2d2315' }, h5: { color: '#2d2315' }, h6: { color: '#2d2315' },
        a: { color: '#b45309' }
      });
      newRendition.themes.register("high-contrast", {
        body: { background: 'transparent', color: '#ffffff', padding: '40px !important' },
        p: { 'line-height': '1.6', color: '#ffffff' },
        h1: { color: '#ffffff' }, h2: { color: '#ffffff' }, h3: { color: '#ffffff' },
        h4: { color: '#ffffff' }, h5: { color: '#ffffff' }, h6: { color: '#ffffff' },
        a: { color: '#60a5fa' }
      });

      
      newRendition.themes.select(bookTheme);
      newRendition.themes.fontSize(`${fontSize}%`);
      let fontStack = bookFont;
      switch (bookFont) {
        case 'Bookerly': fontStack = '"Bookerly", serif'; break;
        case 'Amazon Ember': fontStack = '"Amazon Ember", sans-serif'; break;
        case 'PMN Caecilia': fontStack = '"PMN Caecilia", serif'; break;
        case 'Caecilia Condensed': fontStack = '"Caecilia Condensed", serif'; break;
        case 'Baskerville': fontStack = 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif'; break;
        case 'Helvetica': fontStack = '"Helvetica Neue", Helvetica, Arial, sans-serif'; break;
        case 'Palatino': fontStack = '"Palatino Linotype", "Book Antiqua", Palatino, serif'; break;
        case 'Serif': fontStack = 'Georgia, serif'; break;
        case 'Sans-Serif': fontStack = 'Arial, sans-serif'; break;
        case 'OpenDyslexic': fontStack = '"OpenDyslexic", sans-serif'; break;
        case 'Runethia': fontStack = '"Runethia", cursive'; break;
        case 'Publisher Font': fontStack = 'inherit'; break;
      }
      newRendition.themes.font(fontStack);
      
      const fileKey = `epub_location_${file.name}_${file.size}`;
      const savedLocation = localStorage.getItem(fileKey);
      
      const locToUse = initialLocation || savedLocation;
      const displayPromise = locToUse ? newRendition.display(locToUse) : newRendition.display();

      displayPromise.then(() => {
          if (isCancelled) return;
          updateThreeOverlay();

          try {
            const saved = localStorage.getItem(`epub_notes_${file.name}_${file.size}`);
            const savedNotes = saved ? JSON.parse(saved) : [];
            savedNotes.forEach((note: NoteItem) => {
              newRendition.annotations.highlight(note.cfiRange, {}, (e: Event) => {
                console.log("highlight clicked", e);
              });
            });
          } catch(e) {}

          const charsPerPage = Math.max(100, Math.round(1600 * (100 / fontSize) * (100 / fontSize)));
          readerBook!.locations.generate(charsPerPage).then(() => {
              if (isCancelled) return;
              const total = readerBook!.locations.length();
              setTotalPages(total);
              if (newRendition!.location) {
                  const currentLoc = newRendition!.location.start.cfi;
                  setLocation(currentLoc);
                  setProgress(readerBook!.locations.percentageFromCfi(currentLoc));
              }
          });
      });

      let currentChapterHref = '';
      newRendition.on('relocated', (loc: any) => {
          if (isCancelled) return;
          const chapterHref = loc.start.href;
          if (currentChapterHref && chapterHref !== currentChapterHref) {
             trackChapterCompleted();
          }
          currentChapterHref = chapterHref;
          const cfi = loc.start.cfi;
          
          setLocation(cfi);
          localStorage.setItem(`epub_location_${file.name}_${file.size}`, cfi);
          if (readerBook!.locations.length() > 0) {
              const p = readerBook!.locations.percentageFromCfi(cfi);
              setProgress(p);
              localStorage.setItem(`epub_progress_${file.name}_${file.size}`, String(p));
          }

          const contents = newRendition!.getContents()[0];
          if (contents && contents.document) {
              const text = contents.document.body.innerText || contents.document.body.textContent || '';
              const wordCount = text.split(/\s+/).length;
              if (loc.start.displayed && loc.start.displayed.total > 0) {
                  const { page, total } = loc.start.displayed;
                  const percentLeft = (total - page) / total;
                  const wordsLeft = wordCount * percentLeft;
                  setMinsLeft(Math.max(1, Math.ceil(wordsLeft / 250)));
              } else {
                  setMinsLeft(null);
              }
          }
      });
      
      newRendition.on('mousedown', () => {
          if (isCancelled) return;
          setDictPopup(null);
      });
      
      newRendition.on('selected', async (cfiRange: string, contents: any) => {
          if (isCancelled) return;
          
          const text = newRendition!.getRange(cfiRange).toString().trim();
          
          const selection = contents.window.getSelection();
          let rect = { top: 0, left: 0, bottom: 0, right: 0 };
          if (selection && selection.rangeCount > 0) {
            rect = selection.getRangeAt(0).getBoundingClientRect();
          }
          contents.window.getSelection().removeAllRanges();

          const words = text.split(/\s+/);
          
          if (words.length === 1 && words[0].replace(/[^a-zA-Z]/g, '').length > 0) {
            const word = words[0].replace(/[^a-zA-Z]/g, '');
            setIsFetchingDef(true);
            setDictPopup(null);
            
            let offsetX = 0;
            let offsetY = 0;
            if (viewerRef.current) {
                const viewerRect = viewerRef.current.getBoundingClientRect();
                offsetX = viewerRect.left;
                offsetY = viewerRect.top;
            }
            
            // Position slightly below the word
            const popupX = rect.left + offsetX + (rect.right - rect.left) / 2;
            const popupY = rect.bottom + offsetY + 10;
            
            try {
              const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
              if (res.ok) {
                const data = await res.json();
                const meaning = data[0]?.meanings[0]?.definitions[0]?.definition;
                const phonetic = data[0]?.phonetic || data[0]?.phonetics?.[0]?.text || '';
                
                if (meaning) {
                  setDictPopup({
                    word: data[0].word,
                    def: meaning,
                    phonetic,
                    x: popupX,
                    y: popupY
                  });
                }
              }
            } catch (err) {
              console.error("Dictionary fetch error:", err);
            }
            setIsFetchingDef(false);
          } else {
            newRendition!.annotations.highlight(cfiRange, {}, (e: Event) => {
                console.log("highlight clicked", e);
            });
            
            setNotes(prev => [...prev, { id: Date.now().toString(), cfiRange, excerpt: text, note: '' }]);
            setActiveTab('notes');
            setSidebarOpen(true);
            setFocusMode(false);
          }
      });
      
      // Listen for keyboard events in the iframe
      newRendition.on('keyup', (ev: any) => {
          if (ev.key === 'ArrowLeft') prevPage();
          if (ev.key === 'ArrowRight') nextPage();
      });
      } catch (err) {
        console.error("Failed to load book in reader:", err);
      }
    };
    reader.readAsArrayBuffer(file);

    return () => {
      isCancelled = true;
      if (newRendition) newRendition.destroy();
      if (readerBook) readerBook.destroy();
    };
  }, [file]);

  useEffect(() => {

    if (!threeRef.current)
        return;

    if (bookEngine.current)
        return;

    const engine =
        new BookEngine(
            threeRef.current
        );

    bookEngine.current = engine;

    console.log(
    "Three canvas:",
    bookEngine.current
        ?.getRenderer()
        .domElement
  );

    setEngineReady(true);

    const resize = () => {
        engine.resize();
        updateThreeOverlay();
    };

    window.addEventListener(
        "resize",
        resize
    );

    return () => {

        window.removeEventListener(
            "resize",
            resize
        );

        engine.destroy();

        bookEngine.current = null;

    };

}, []);

  useEffect(() => {
    if (rendition && book) {
      rendition.themes.fontSize(`${fontSize}%`);
      
      const charsPerPage = Math.max(100, Math.round(1600 * (100 / fontSize) * (100 / fontSize)));
      book.locations.generate(charsPerPage).then(() => {
        const total = book.locations.length();
        setTotalPages(total);
        if (rendition.location) {
            const currentLoc = rendition.location.start.cfi;
            setProgress(book.locations.percentageFromCfi(currentLoc));
        }
      }).catch(e => console.warn(e));
    }
  }, [fontSize, rendition, book]);

  const capturePageTexture = async (): Promise<HTMLCanvasElement | null> => {

      if (!viewerRef.current) {
        return null;
      }

      const iframe = viewerRef.current.querySelector("iframe");

      if (!iframe) {
          return null;
      }
  
      const doc = iframe.contentDocument;

      if (!doc) {
          return null;
      }

      const target =
          doc.querySelector(".epub-view") ||
          doc.documentElement;

      console.log("capture target", target);
      console.log(
                  "target rect",
                  (target as HTMLElement).getBoundingClientRect()
      );
      const body = doc.body;

      console.log("scrollWidth", body.scrollWidth);
      console.log("clientWidth", body.clientWidth);
      console.log("offsetWidth", body.offsetWidth);

      console.log("computed", getComputedStyle(body).columnWidth);
      console.log("columnGap", getComputedStyle(body).columnGap);

      const canvas = await html2canvas(target as HTMLElement, {
          backgroundColor: null,
          scale: window.devicePixelRatio,
          useCORS: true,
          logging: false,
      });

      return canvas;
  };
  
  const updateThreeOverlay = () => {

      if (!viewerRef.current || !threeRef.current) return;

      const iframe = viewerRef.current.querySelector("iframe");
      const doc = iframe?.contentDocument;

      if (!(iframe instanceof HTMLIFrameElement)) return;

      const rect = iframe.getBoundingClientRect();
      const parent = viewerRef.current.getBoundingClientRect();

      threeRef.current.style.left = "0px";
      threeRef.current.style.top = "0px";
      threeRef.current.style.width = `${rect.width}px`;
      threeRef.current.style.height = `${rect.height}px`;

  };

  const syncBookEngine = async (): Promise<void> => {

     if (!bookEngine.current) return;

     if (!rendition) return;

     const canvas = await capturePageTexture();

     console.log("Captured canvas:", canvas);

  };

  const nextPage = async () => {
    if (rendition) {
      setPageTransition('next');
      await rendition.next();
      
      await syncBookEngine();
      setTimeout(() => setPageTransition('none'), 300);
    }
  };

  const prevPage = async () => {
    if (rendition) {
      setPageTransition('prev');
      await rendition.prev();
      await syncBookEngine();
      setTimeout(() => setPageTransition('none'), 300);
    }
  };

  

  const handleCurlComplete = () => {
    setCurlAnimating(false);
  };

  const goTo = async (href: string) => {
    if (rendition) {
      setPageTransition('chapter');
      await rendition.display(href);
      setTimeout(() => setPageTransition('none'), 300);
    }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
          if (e.key === 'ArrowLeft') prevPage();
          if (e.key === 'ArrowRight') nextPage();
          if (e.key.toLowerCase() === 't') { setActiveTab('toc'); setSidebarOpen(true); }
          if (e.key.toLowerCase() === 'b') toggleBookmark();
          if (e.key.toLowerCase() === 's') setSettingsOpen(s => !s);
          if (e.key.toLowerCase() === 'f') { setActiveTab('search'); setSidebarOpen(true); }
          if (e.key.toLowerCase() === 'm') setFocusMode(f => !f);
          if (e.key === 'Escape' && focusMode) setFocusMode(false);
          if (e.key === ' ') { e.preventDefault(); toggleTTS(); }
          if (e.key === '?') setShowShortcuts(s => !s);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition, isPlaying, playbackRate, bookmarks, focusMode]);
  
  useEffect(() => {
    if (rendition) {
      rendition.themes.select(bookTheme);
    }
  }, [rendition, bookTheme]);

  useEffect(() => {
    if (rendition) {
      let fontStack = bookFont;
      switch (bookFont) {
        case 'Bookerly': fontStack = '"Bookerly", serif'; break;
        case 'Amazon Ember': fontStack = '"Amazon Ember", sans-serif'; break;
        case 'PMN Caecilia': fontStack = '"PMN Caecilia", serif'; break;
        case 'Caecilia Condensed': fontStack = '"Caecilia Condensed", serif'; break;
        case 'Baskerville': fontStack = 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif'; break;
        case 'Helvetica': fontStack = '"Helvetica Neue", Helvetica, Arial, sans-serif'; break;
        case 'Palatino': fontStack = '"Palatino Linotype", "Book Antiqua", Palatino, serif'; break;
        case 'Serif': fontStack = 'Georgia, serif'; break;
        case 'Sans-Serif': fontStack = 'Arial, sans-serif'; break;
        case 'OpenDyslexic': fontStack = '"OpenDyslexic", sans-serif'; break;
        case 'Runethia': fontStack = '"Runethia", cursive'; break;
        case 'Publisher Font': fontStack = 'inherit'; break;
      }
      rendition.themes.font(fontStack);
    }
  }, [rendition, bookFont]);
  
  useEffect(() => {
    return () => {
       // Flush remaining session time upon unmount/exiting
       setSessionSeconds(current => {
         const remainder = current % 60;
         if (remainder > 30) {
           trackReadingMinute();
         }
         return current;
       });
    };
  }, []);

  const toggleBookmark = () => {
    if (!rendition || !rendition.location) return;
    const cfi = rendition.location.start.cfi;
    
    if (bookmarks.some(b => b.cfi === cfi)) {
      setBookmarks(bookmarks.filter(b => b.cfi !== cfi));
    } else {
      const percentage = book?.locations.percentageFromCfi(cfi) || 0;
      const curPage = totalPages ? Math.max(1, Math.round(percentage * totalPages)) : 0;
      setBookmarks([...bookmarks, { cfi, percentage, label: `Page ${curPage}` }]);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const spineItems = (book.spine as any).spineItems || [];
      const results = await Promise.all(
        spineItems.map((item: any) => 
          item.load(book.load.bind(book)).then(() => {
            const res = item.find(searchQuery);
            item.unload();
            return res || [];
          }).catch(() => [])
        )
      );
      const flattened = ([] as any[]).concat(...results);
      setSearchResults(flattened.map((r: any) => ({ cfi: r.cfi, excerpt: r.excerpt })));
    } catch(err) {
      console.error(err);
    }
    setIsSearching(false);
  };


  const shareQuote = async (excerpt: string, note?: string) => {
    try {
      const textToShare = `"${excerpt}"\n\n${note ? `— ${note}\n\n` : ''}Via Reading Dashboard`;
      await navigator.clipboard.writeText(textToShare);
      alert('Quote card copied to clipboard!');
    } catch(err) {
      console.error(err);
      alert('Failed to copy to clipboard.');
    }
  };

  const isBookmarked = typeof location === 'string' && bookmarks.some(b => b.cfi === location);
  
  
  const locationObj = (rendition && (rendition as any).manager && typeof (rendition as any).currentLocation === 'function') ? (rendition as any).currentLocation() : null;
  let currentPageDisplay = totalPages ? Math.max(1, Math.round(progress * (totalPages - 1)) + 1) : 0;

  
  console.log("progress:", progress, "totalPages:", totalPages, "currentPageDisplay:", currentPageDisplay);



  const updateNote = (id: string, text: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, note: text } : n));
  };

  const deleteNote = (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (noteToDelete && rendition) {
      rendition.annotations.remove(noteToDelete.cfiRange, "highlight");
    }
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className={`flex h-screen w-full flex-col bg-[#f3f4f6] dark:bg-[#121212] font-sans text-gray-800 dark:text-gray-200 overflow-hidden select-none relative ${isDark ? 'dark' : ''}`}>
      {/* Top Toolbar */}
      <AnimatePresence>
        {!focusMode && (
          <motion.header 
            initial={{ y: -48 }}
            animate={{ y: 0 }}
            exit={{ y: -48 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="flex h-12 items-center justify-between border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1a1a] px-4 shrink-0 z-10"
          >
            <div className="flex items-center gap-4 w-1/3">

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:text-white transition-colors"
                title="Toggle Sidebar"
              >
                <Menu size={16} />
              </button>
              <button
                onClick={() => onClose(sessionSeconds * 1000, progress)}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:text-white transition-colors"
                title="Close Book"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-sm font-medium text-black/70 dark:text-white/70 tracking-tight flex-1 text-center truncate px-4">
              {file.name.replace(/\.epub$/i, '')}
            </div>
            <div className="flex w-1/3 justify-end gap-2 relative items-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 mr-2">
                <Clock size={14} />
                <span className="text-xs font-mono font-medium">
                  {Math.floor(sessionSeconds / 60).toString().padStart(2, '0')}:{(sessionSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={() => {
                  const newIsTwoPage = !isTwoPage;
                  setIsTwoPage(newIsTwoPage);
                  if (rendition) {
                    rendition.spread(newIsTwoPage ? 'auto' : 'none');
                  }
                }}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors text-black/50 dark:text-white/50 hover:text-black dark:text-white"
                title={isTwoPage ? "Switch to Single Page" : "Switch to Two-Page Spread"}
              >
                {isTwoPage ? <BookIcon size={16} /> : <BookOpen size={16} />}
              </button>
              <button
                onClick={() => setIsDashboardOpen(true)}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors text-black/50 dark:text-white/50 hover:text-black dark:text-white"
                title="Reading Dashboard"
              >
                <BarChart2 size={16} />
              </button>
              <button
                onClick={() => setFocusMode(true)}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors text-black/50 dark:text-white/50 hover:text-black dark:text-white"
                title="Focus Mode (M)"
              >
                <Maximize size={16} />
              </button>
              <button
                onClick={() => setShowShortcuts(true)}
                className="p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors text-black/50 dark:text-white/50 hover:text-black dark:text-white"
                title="Keyboard Shortcuts"
              >
                <Keyboard size={16} />
              </button>
              <button
                onClick={toggleTTS}
                className={`p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors ${isPlaying ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:text-black dark:text-white'}`}
                title="Read Aloud"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button 
                onClick={toggleBookmark}
                className={`p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors ${isBookmarked ? 'text-blue-400' : 'text-black/50 dark:text-white/50 hover:text-black dark:text-white'}`} 
                title="Bookmark this page"
              >
                <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>
              <button 
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={`p-1.5 rounded-md hover:bg-black/10 dark:bg-white/10 transition-colors ${settingsOpen ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:text-black dark:text-white'}`} 
                title="Display Settings"
              >
                <Settings size={16} />
              </button>
              
              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-10 right-0 w-64 bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-4 z-50 origin-top-right"
                  >
                    
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">UI Theme</span>
                </div>
                <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 gap-1">
                  <button 
                    onClick={() => setThemePref('light')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${themePref === 'light' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                  >
                    Light
                  </button>
                  <button 
                    onClick={() => setThemePref('dark')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${themePref === 'dark' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                  >
                    Dark
                  </button>
                  <button 
                    onClick={() => setThemePref('system')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${themePref === 'system' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                  >
                    System
                  </button>
                </div>
                
                <div className="mb-2 flex items-center justify-between mt-6">
                  <span className="text-xs font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">Reader Theme</span>
                </div>
                <div className="grid grid-cols-2 bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-4 gap-1">
                  <button 
                    onClick={() => setBookTheme('light')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${bookTheme === 'light' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                  >
                    Classic Light
                  </button>
                  <button 
                    onClick={() => setBookTheme('dark')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${bookTheme === 'dark' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                  >
                    Classic Dark
                  </button>
                  <button 
                    onClick={() => setBookTheme('sepia')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${bookTheme === 'sepia' ? 'bg-[#f4ecd8] text-[#5b4636] shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-[#5b4636] dark:hover:text-[#f4ecd8]'}`}
                  >
                    Sepia
                  </button>
                  <button 
                    onClick={() => setBookTheme('high-contrast')}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${bookTheme === 'high-contrast' ? 'bg-black text-white shadow-sm' : 'text-black/50 dark:text-white/50 hover:text-white dark:hover:text-white hover:bg-black/50'}`}
                  >
                    High Contrast
                  </button>
                </div>

                <div className="mb-2 flex items-center justify-between mt-6">
                  <span className="text-xs font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">Font Family</span>
                </div>
                <div className="mb-4">
                  <select 
                    value={bookFont}
                    onChange={(e) => setBookFont(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-sm text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                  >
                        <option value="Bookerly">Bookerly</option>
                        <option value="Amazon Ember">Amazon Ember</option>
                        <option value="PMN Caecilia">PMN Caecilia</option>
                        <option value="Caecilia Condensed">Caecilia Condensed</option>
                        <option value="Baskerville">Baskerville</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Palatino">Palatino</option>
                        <option value="Serif">Serif</option>
                        <option value="Sans-Serif">Sans-Serif</option>
                        <option value="OpenDyslexic">OpenDyslexic</option>
                        <option value="Runethia">Runethia</option>
                        <option value="Publisher Font">Publisher Font</option>
                  </select>
                </div>

                <div className="mb-2 flex items-center justify-between mt-6">
                      <span className="text-xs font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">Text Size</span>
                      <span className="text-xs text-black/80 dark:text-white/80">{fontSize}%</span>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <button 
                        onClick={() => setFontSize(Math.max(50, fontSize - 10))}
                        className="flex-1 flex justify-center items-center py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-lg text-black dark:text-white transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="px-2">
                        <Type size={16} className="text-black/50 dark:text-white/50" />
                      </div>
                      <button 
                        onClick={() => setFontSize(Math.min(250, fontSize + 10))}
                        className="flex-1 flex justify-center items-center py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-lg text-black dark:text-white transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <div className="mb-2 flex items-center justify-between mt-4">
                      <span className="text-xs font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">Speech Speed</span>
                      <span className="text-xs text-black/80 dark:text-white/80">{playbackRate}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.25))}
                        className="flex-1 flex justify-center items-center py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-lg text-black dark:text-white transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="px-2">
                        <Play size={16} className="text-black/50 dark:text-white/50" />
                      </div>
                      <button 
                        onClick={() => setPlaybackRate(Math.min(2, playbackRate + 0.25))}
                        className="flex-1 flex justify-center items-center py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-lg text-black dark:text-white transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen && !focusMode && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="h-full bg-[#181818] border-r border-black/5 dark:border-white/5 flex flex-col z-20 shrink-0"
            >
              <div className="p-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-1">
                <button
                  onClick={() => setActiveTab('toc')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'toc' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Contents"
                >
                  <BookOpen size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('thumbnails')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'thumbnails' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Thumbnails"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'notes' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Notes & Highlights"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'bookmarks'? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Bookmarks"
                >
                  <Bookmark size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'bookmarks'? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Search"
                >
                  <Search size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex-1 py-2 flex justify-center items-center rounded-md transition-colors ${activeTab === 'bookmarks'? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:text-white/60 hover:bg-black/5 dark:bg-white/5'}`}
                  title="Stats"
                >
                  <BarChart2 size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
                {activeTab === 'thumbnails' && (
                  <div className="grid grid-cols-2 gap-3 p-1">
                    {toc.map((item, i) => (
                      <div 
                        key={i} 
                        onClick={() => goTo(item.href)}
                        className="aspect-[3/4] bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm border border-black/5 dark:border-white/5 cursor-pointer hover:shadow-md transition-all flex flex-col p-3 overflow-hidden relative group"
                      >
                        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-[9px] text-black/40 dark:text-white/40 font-semibold mb-2 uppercase tracking-wider">Chapter {i + 1}</div>
                        <div className="text-xs text-black/80 dark:text-white/80 font-serif font-medium line-clamp-4 leading-relaxed">
                          {item.label}
                        </div>
                        <div className="mt-auto pt-2">
                            <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500/50 w-0" />
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'toc' && (
                  <>
                    {toc.length === 0 && (
                      <div className="p-4 text-xs text-black/40 dark:text-white/40 text-center">Loading contents...</div>
                    )}
                    <ul className="space-y-1">
                      {toc.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-black/50 dark:text-white/50 hover:text-black dark:text-white hover:bg-black/5 dark:bg-white/5 rounded-md cursor-pointer transition-colors truncate"
                          onClick={() => goTo(item.href)}
                        >
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                
                {activeTab === 'notes' && (
                  <div className="flex flex-col h-full gap-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Your Notes</span>
                      {notes.length > 0 && (
                        <button 
                          onClick={exportNotes}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          <Download size={12} />
                          Export
                        </button>
                      )}
                    </div>
                    {notes.length === 0 && (
                      <div className="p-4 text-xs text-black/40 dark:text-white/40 text-center">Select text in the book to highlight and add notes.</div>
                    )}
                    {notes.map(note => (
                      <div key={note.id} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg overflow-hidden flex flex-col relative group">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          className="absolute right-2 top-2 p-1 bg-black/10 dark:bg-white/10 hover:bg-red-500/80 text-black/50 dark:text-white/50 hover:text-white rounded-full z-10 transition-colors opacity-100 md:opacity-0 group-hover:opacity-100"
                          title="Delete note"
                        >
                          <X size={12} />
                        </button>
                        <div 
                          className="p-3 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/[0.04] dark:bg-white/[0.04] transition-colors pr-8"
                          onClick={() => goTo(note.cfiRange)}
                        >
                          <div className="w-1.5 h-full bg-blue-500 absolute left-0 top-0 bottom-0" />
                          <p className="text-xs text-black/80 dark:text-white/80 italic line-clamp-3 relative pl-2">
                            "{note.excerpt}"
                          </p>
                        </div>
                        <div className="p-2 relative">
                          <textarea
                            value={note.note}
                            onChange={(e) => updateNote(note.id, e.target.value)}
                            placeholder="Add a note..."
                            className="w-full bg-transparent text-sm text-black dark:text-white focus:outline-none resize-none h-16"
                          />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const existing = JSON.parse(localStorage.getItem('reader_saved_quotes') || '[]');
                              if (!existing.some((q) => q.text === note.excerpt)) {
                                existing.push({ id: Date.now().toString(), text: note.excerpt, note: note.note, date: new Date().toISOString() });
                                localStorage.setItem('reader_saved_quotes', JSON.stringify(existing));
                                alert('Quote saved to Dashboard!');
                              } else {
                                alert('Quote already saved!');
                              }
                            }}
                            className="absolute right-10 bottom-2 p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                            title="Save as Daily Quote"
                          >
                            <Quote size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                shareQuote(note.excerpt, note.note);
                            }}
                            className="absolute right-2 bottom-2 p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-md transition-colors"
                            title="Share Quote to Clipboard"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {activeTab === 'bookmarks'&& (
                  <>
                    {bookmarks.length === 0 && (
                      <div className="p-4 text-xs text-black/40 dark:text-white/40 text-center">No bookmarks yet.</div>
                    )}
                    <ul className="space-y-1">
                      {bookmarks.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between px-3 py-2 text-sm text-black/50 dark:text-white/50 hover:text-black dark:text-white hover:bg-black/5 dark:bg-white/5 rounded-md cursor-pointer transition-colors"
                          onClick={() => goTo(b.cfi)}
                        >
                          <span>{b.label}</span>
                          <span className="text-[10px] opacity-40">{Math.round(b.percentage * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                
                {activeTab === 'bookmarks'&& (
                  <div className="flex flex-col h-full">
                    <form onSubmit={handleSearch} className="mb-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="w-full bg-gray-100 dark:bg-[#252525] border border-black/10 dark:border-white/10 rounded-md py-1.5 pl-8 pr-3 text-sm text-black dark:text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
                      </div>
                    </form>
                    
                    <div className="flex-1 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-xs text-black/40 dark:text-white/40 text-center">Searching...</div>
                      ) : searchResults.length > 0 ? (
                        <ul className="space-y-2">
                          {searchResults.map((r, i) => (
                            <li
                              key={i}
                              className="p-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-md cursor-pointer transition-colors"
                              onClick={() => goTo(r.cfi)}
                            >
                              <p className="text-xs text-black/70 dark:text-white/70 line-clamp-3 leading-relaxed">
                                ...{r.excerpt}...
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : searchQuery && !isSearching ? (
                        <div className="p-4 text-xs text-black/40 dark:text-white/40 text-center">No results found.</div>
                      ) : null}
                    </div>
                  </div>
                )}
                
                {activeTab === 'bookmarks'&& (
                  <div className="flex flex-col h-full">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-4 px-1">Daily Goal</h4>
                    
                    <div className="bg-gray-100 dark:bg-[#252525] p-4 rounded-xl border border-black/5 dark:border-white/5 mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <Target size={14} className="text-blue-400" />
                          <span className="text-xs text-black/70 dark:text-white/70 font-medium">Reading Target</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setReadingGoal(Math.max(5, readingGoal - 5))} className="text-black/40 dark:text-white/40 hover:text-black/80 dark:text-white/80 p-1"><Minus size={12}/></button>
                           <span className="text-xs font-medium w-8 text-center">{readingGoal}m</span>
                           <button onClick={() => setReadingGoal(readingGoal + 5)} className="text-black/40 dark:text-white/40 hover:text-black/80 dark:text-white/80 p-1"><Plus size={12}/></button>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden mb-2 relative">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (dailyReadTime / readingGoal) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-black/40 dark:text-white/40">
                        <span>{dailyReadTime} mins read</span>
                        <span>{Math.max(0, readingGoal - dailyReadTime)} mins left</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 p-4 rounded-xl mb-6">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-orange-500/20 rounded-lg">
                           <Flame size={16} className={`text-orange-500 ${dailyReadTime >= readingGoal ? 'animate-pulse' : ''}`} />
                         </div>
                         <div>
                           <div className="text-sm font-medium text-black/90 dark:text-white/90">{streak} Day Streak</div>
                           <div className="text-[10px] text-black/50 dark:text-white/50">{dailyReadTime >= readingGoal ? 'Goal reached today!' : "You're on fire! Keep it up."}</div>
                         </div>
                       </div>
                    </div>

                    <h4 className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-4 px-1">Reading Time</h4>
                    <div className="h-40 w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mockStatsData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Area type="monotone" dataKey="hours" stroke="#60a5fa" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pb-4">
                      <div className="bg-gray-100 dark:bg-[#252525] p-3 rounded-lg border border-black/5 dark:border-white/5">
                        <div className="text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Total Time</div>
                        <div className="text-lg font-medium text-black/90 dark:text-white/90">12.1 <span className="text-xs text-black/40 dark:text-white/40">hrs</span></div>
                      </div>
                      <div className="bg-gray-100 dark:bg-[#252525] p-3 rounded-lg border border-black/5 dark:border-white/5">
                        <div className="text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Avg Speed</div>
                        <div className="text-lg font-medium text-black/90 dark:text-white/90">250 <span className="text-xs text-black/40 dark:text-white/40">wpm</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Audio Player Integration */}
              <div className="border-t border-black/10 dark:border-white/10 p-4 bg-black/5 dark:bg-white/5 shrink-0">
                <div className="flex items-center gap-2 mb-3 text-black/60 dark:text-white/60">
                  <Headphones size={16} />
                  <span className="text-xs font-bold tracking-wider uppercase">Audio Companion</span>
                </div>
                {!audioFile ? (
                  <div className="flex items-center justify-center border-2 border-dashed border-black/10 dark:border-white/10 rounded-lg p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <label className="flex flex-col items-center gap-2 cursor-pointer w-full text-center">
                      <Upload size={16} className="text-black/40 dark:text-white/40" />
                      <span className="text-[10px] text-black/60 dark:text-white/60 uppercase tracking-wider font-medium">Upload Audiobook</span>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setAudioFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] text-black/60 dark:text-white/60 mb-1">
                      <span className="truncate max-w-[120px]">{audioFile.name}</span>
                      <button 
                        onClick={() => setAudioFile(null)} 
                        className="hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <audio 
                      ref={audioRef}
                      src={audioUrl || ''}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onLoadedMetadata={() => {
                        if (audioRef.current) setAudioDuration(audioRef.current.duration);
                      }}
                      onPlay={() => setIsAudioPlaying(true)}
                      onPause={() => setIsAudioPlaying(false)}
                      onEnded={() => setIsAudioPlaying(false)}
                      controls
                      className="w-full h-8 outline-none"
                      style={{ filter: 'grayscale(1) invert(0.8)' }}
                    />
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={syncAudio} 
                        onChange={(e) => setSyncAudio(e.target.checked)} 
                        className="rounded border-white/20 bg-black/10 dark:bg-white/10 text-blue-500"
                      />
                      <span className="text-[10px] text-black/60 dark:text-white/60">Auto-sync with book progress</span>
                    </label>
                  </div>
                )}
              </div>
              
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full relative bg-[#f3f4f6] dark:bg-[#121212]">
          
          <AnimatePresence>
            {focusMode && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setFocusMode(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/80 dark:text-white/80 transition-colors z-30"
                title="Exit Focus Mode (Esc or M)"
              >
                <Minimize size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Reader Canvas */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden pb-4 pt-4 px-12">
              <AnimatePresence>
                {!focusMode && (
                  <motion.button 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={prevPage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-black/5 dark:bg-white/5 text-black/20 dark:text-white/20 hover:text-black/60 dark:text-white/60 transition-colors z-10 focus:outline-none"
                  >
                      <ChevronLeft size={32} strokeWidth={1.5} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Book Cover Wrapper */}
              <div className={`w-full max-w-5xl ${focusMode ? 'h-[96vh]' : 'h-[85vh]'} transition-all duration-500 relative bg-[#8b1c1c] dark:bg-[#4a0e0e] rounded-xl shadow-[inset_0_0_10px_rgba(0,0,0,0.5),0_20px_25px_-5px_rgba(0,0,0,0.5)] border-4 border-[#5a1010] dark:border-[#2a0505] p-2 md:px-8 md:py-4 flex items-center justify-center before:content-[''] before:absolute before:left-2 before:right-2 before:top-1 before:bottom-1 before:rounded-lg before:border before:border-white/10 before:pointer-events-none`}>
                
                {/* Book Page Container with Page Turn Animation Wrapper */}
                <motion.div 
                    className={`w-full h-full relative overflow-hidden rounded flex custom-book-shadow ${
                      bookTheme === 'sepia' ? 'bg-[#f4ecd8]' :
                      bookTheme === 'high-contrast' ? 'bg-[#000000]' :
                      bookTheme === 'dark' ? 'bg-[#1a1a1a]' :
                      'bg-[#fdfbf7]'
                    }`}

                    animate={
                        pageTransition === 'next' ? { scale: [0.99, 1], opacity: [0.9, 1] } :
                        pageTransition === 'prev' ? { scale: [0.99, 1], opacity: [0.9, 1] } :
                        pageTransition === 'chapter' ? { opacity: [0, 1], scale: [0.98, 1] } :
                        { opacity: 1, scale: 1 }
                    }
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {/* Spine Shadow and Details */}
                    {isTwoPage && (
                      <>
                        <div className="absolute left-1/2 top-0 bottom-0 w-24 -ml-12 bg-gradient-to-r from-transparent via-black/10 dark:via-black/50 to-transparent pointer-events-none z-20" />
                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-black/5 dark:bg-black/40 pointer-events-none z-20" />
                        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -ml-[1px] bg-gradient-to-r from-white/20 to-transparent dark:from-white/5 pointer-events-none z-20" />
                      </>
                    )}
                    
      
              
  <motion.div
      className="w-full h-full"
      style={{ perspective: "1200px" }}
  >
    <div className="w-full h-full">
        <div className="relative w-full h-full overflow-hidden">

            <div
                ref={viewerRef}
                className="absolute inset-0 z-10"
            />

            <div
                ref={threeRef}
                className="absolute inset-0 z-20 pointer-events-none"
                style={{
                   opacity: 1,
                   visibility: "visible",
                }}
            />

        </div>
    </div>
</motion.div>

              
              
                    


                    
                        <div className={`absolute bottom-4 left-0 right-0 flex justify-between px-8 pointer-events-none z-50 font-serif ${bookTheme === 'sepia' ? 'text-[#5b4636]/60' : bookTheme === 'dark' ? 'text-[#e5e7eb]/40' : bookTheme === 'high-contrast' ? 'text-white/60' : 'text-[#1f2937]/40'}`}>
                            {totalPages > 0 ? (
                              isTwoPage ? (
                                <>
                                  <span className="text-[12px] opacity-70 pl-6">{currentPageDisplay}</span>
                                  <span className="text-[12px] opacity-70 pr-6">{currentPageDisplay + 1 <= totalPages ? currentPageDisplay + 1 : ''}</span>
                                </>
                              ) : (
                                <div className="w-full text-center">
                                  <span className="text-[12px] opacity-70">{currentPageDisplay}</span>
                                </div>
                              )
                            ) : (
                               <div className="w-full text-center">
                                  <span className="text-[11px] opacity-40 italic">Calculating...</span>
                                </div>
                            )}
                        </div>
                    
                </motion.div>
              </div>

              <AnimatePresence>
                {!focusMode && (
                  <motion.button 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={nextPage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-black/5 dark:bg-white/5 text-black/20 dark:text-white/20 hover:text-black/60 dark:text-white/60 transition-colors z-10 focus:outline-none"
                  >
                      <ChevronRight size={32} strokeWidth={1.5} />
                  </motion.button>
                )}
              </AnimatePresence>
          </div>

          {/* Bottom Progress Bar Mini */}
          <AnimatePresence>
            {!focusMode && (
              <motion.div 
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 32, opacity: 0 }}
                className="absolute bottom-8 left-0 right-0 flex justify-center items-center px-12 pointer-events-none z-10"
              >
                <div className="bg-black/60 dark:bg-[#1a1a1a]/80 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full px-5 py-2 flex items-center shadow-2xl pointer-events-auto text-white">
                  <div className="flex items-center justify-end w-12 pr-3 border-r border-white/20 dark:border-white/10">
                    <input 
                      type="text" 
                      className="w-full text-right bg-transparent outline-none text-[11px] font-medium text-white/90 tabular-nums placeholder:text-white/50"
                      value={jumpPageInput !== '' ? jumpPageInput : (totalPages > 0 ? currentPageDisplay : 1)}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      onBlur={() => setJumpPageInput('')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const page = parseInt(jumpPageInput);
                          if (page && page > 0 && page <= totalPages && book) {
                            const percentage = page / totalPages;
                            const cfi = book.locations.cfiFromPercentage(percentage);
                            if (cfi && rendition) rendition.display(cfi);
                          }
                          setJumpPageInput('');
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden relative cursor-pointer mx-4"
                    onClick={(e) => {
                       if (!book || !totalPages) return;
                       const rect = e.currentTarget.getBoundingClientRect();
                       const x = e.clientX - rect.left;
                       const percentage = x / rect.width;
                       const cfi = book.locations.cfiFromPercentage(percentage);
                       if (cfi && rendition) rendition.display(cfi);
                    }}
                  >
                    <div 
                        className="absolute left-0 top-0 bottom-0 bg-white transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center w-12 pl-3 border-l border-white/20 dark:border-white/10 text-[11px] font-medium text-white/90 tabular-nums">
                    {totalPages ? totalPages : '...'}
                  </div>

                  <div className="flex items-center ml-1 pl-3 border-l border-white/20 dark:border-white/10">
                    <span className="text-[10px] font-medium text-white/60 tracking-wider">
                      {minsLeft !== null ? (minsLeft === 1 ? '< 1m left' : `${minsLeft}m left`) : '...'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        
        <ReadingDashboard isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />
      </div>

      <AnimatePresence>
        {milestoneMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-full shadow-2xl shadow-blue-500/20 flex items-center gap-3 border border-white/20 pointer-events-none"
          >
            <span className="font-semibold text-sm tracking-wide">{milestoneMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showShortcuts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-black dark:text-white">Keyboard Shortcuts</h2>
                <button onClick={() => setShowShortcuts(false)} className="text-black/50 dark:text-white/50 hover:text-black dark:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 p-1 rounded-md transition-colors"><X size={16} /></button>
              </div>
              <div className="flex flex-col">
                <ShortcutRow keys={['←']} desc="Previous Page" />
                <ShortcutRow keys={['→']} desc="Next Page" />
                <ShortcutRow keys={['Space']} desc="Play / Pause TTS" />
                <ShortcutRow keys={['T']} desc="Toggle Contents" />
                <ShortcutRow keys={['B']} desc="Toggle Bookmark" />
                <ShortcutRow keys={['S']} desc="Display Settings" />
                <ShortcutRow keys={['F']} desc="Search" />
                <ShortcutRow keys={['M']} desc="Toggle Focus Mode" />
                <ShortcutRow keys={['?']} desc="Show Shortcuts" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isFetchingDef && !dictPopup && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.9 }}
             className="fixed z-50 bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-3"
             style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
           >
             <div className="flex items-center gap-2 text-black/50 dark:text-white/50 text-sm">
               <div className="w-4 h-4 border-2 border-black/20 dark:border-white/20 border-t-white/80 rounded-full animate-spin" />
               Looking up word...
             </div>
           </motion.div>
        )}
        {dictPopup && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed z-50 bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-4 w-72 max-w-[90vw]"
            style={{ 
              left: Math.min(Math.max(10, dictPopup.x - 144), typeof window !== 'undefined' ? window.innerWidth - 300 : 1000), 
              top: Math.min(dictPopup.y, typeof window !== 'undefined' ? window.innerHeight - 150 : 800)
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-base font-bold text-black dark:text-white capitalize">{dictPopup.word}</h4>
                {dictPopup.phonetic && <span className="text-xs text-black/40 dark:text-white/40 font-mono">{dictPopup.phonetic}</span>}
              </div>
              <button onClick={() => setDictPopup(null)} className="text-black/40 dark:text-white/40 hover:text-black/90 dark:text-white/90 p-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {dictPopup.def}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
