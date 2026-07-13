const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = code.indexOf('const renderWoodenShelf = ');
const endIdx = code.indexOf('  return (', startIdx);
const oldCode = code.substring(startIdx, endIdx);

const newCode = `const woodThemes: Record<string, { top: string, front: string, lines: string, bottom: string }> = {
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
        default: return { bg: \`bg-[\${baseWoodColor}]\`, border: \`border-2 border-[\${baseWoodBorder}]\`, text: 'text-[#f4ebd0]', shadow: 'shadow-md inset-shadow' };
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
          <div className={\`group/label px-4 py-1.5 rounded flex items-center gap-2 cursor-pointer transition-colors \${labelStyleInfo.bg} \${labelStyleInfo.border} \${labelStyleInfo.shadow}\`}
               style={shelfInfo?.labelStyle === 'wood' || !shelfInfo?.labelStyle ? { boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)', backgroundColor: woodTheme.lines, borderColor: woodTheme.bottom } : {}}
               onClick={() => { setEditingShelfId(shelfInfo.id); setEditingShelfName(shelfInfo.name); }}
          >
            <span className={\`text-[10px] sm:text-xs font-serif font-bold tracking-wider uppercase \${labelStyleInfo.text}\`} style={{ textShadow: (shelfInfo?.labelStyle === 'wood' || !shelfInfo?.labelStyle) ? '0 -1px 0 rgba(0,0,0,0.5)' : 'none' }}>
              {shelfInfo.name}
            </span>
            <Edit2 size={10} className={\`opacity-0 group-hover/label:opacity-100 transition-opacity \${labelStyleInfo.text}\`} />
            
            <button onClick={(e) => { e.stopPropagation(); setCustomizeShelfId(shelfInfo.id); }} className={\`ml-1 opacity-0 group-hover/label:opacity-100 transition-opacity \${labelStyleInfo.text} hover:scale-110\`}>
              <Settings size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteShelf(shelfInfo.id); }} className={\`ml-2 hover:text-red-400 opacity-0 group-hover/label:opacity-100 transition-opacity \${labelStyleInfo.text}\`}>
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
          className={\`relative group cursor-pointer pointer-events-auto flex flex-col items-center \${draggedBookId === book.id ? 'opacity-50' : ''}\`}
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
                  <div className="h-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" style={{ width: \`\${book.progress * 100}%\` }} />
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
          style={{ backgroundImage: \`linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(0,0,0,0.2))\`, backgroundColor: woodTheme.top }}
        ></div>
        <div className="w-full h-6 relative overflow-hidden flex flex-col justify-between shadow-[inset_0_-2px_5px_rgba(0,0,0,0.3)]" style={{ backgroundColor: woodTheme.front }}>
            <div className="w-full h-[1px] bg-white/50" />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: \`repeating-linear-gradient(90deg, transparent 0px, transparent 30px, \${woodTheme.lines} 30px, \${woodTheme.lines} 33px)\` }} />
            <div className="w-full h-[2px]" style={{ backgroundColor: woodTheme.bottom }} />
        </div>
    </div>
  </motion.div>
)};

`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);
console.log('patched successfully');
