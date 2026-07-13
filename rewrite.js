const fs = require('fs');
let c = fs.readFileSync('src/components/Reader.tsx', 'utf-8');

const reps = [
  ['bg-[#121212]', 'bg-[#f3f4f6] dark:bg-[#121212]'],
  ['bg-[#1a1a1a]', 'bg-white dark:bg-[#1a1a1a]'],
  ['bg-[#1e1e1e]', 'bg-white dark:bg-[#1e1e1e]'],
  ['bg-[#252525]', 'bg-gray-100 dark:bg-[#252525]'],
  ['border-white/5', 'border-black/5 dark:border-white/5'],
  ['border-white/10', 'border-black/10 dark:border-white/10'],
  ['bg-white/5', 'bg-black/5 dark:bg-white/5'],
  ['bg-white/10', 'bg-black/10 dark:bg-white/10'],
  ['bg-white/\\[0\\.02\\]', 'bg-black/[0.02] dark:bg-white/[0.02]'],
  ['bg-white/\\[0\\.04\\]', 'bg-black/[0.04] dark:bg-white/[0.04]'],
  ['text-white/20', 'text-black/20 dark:text-white/20'],
  ['text-white/30', 'text-black/30 dark:text-white/30'],
  ['text-white/40', 'text-black/40 dark:text-white/40'],
  ['text-white/50', 'text-black/50 dark:text-white/50'],
  ['text-white/60', 'text-black/60 dark:text-white/60'],
  ['text-white/70', 'text-black/70 dark:text-white/70'],
  ['text-white/80', 'text-black/80 dark:text-white/80'],
  ['text-white/90', 'text-black/90 dark:text-white/90'],
  ['text-white', 'text-black dark:text-white'],
  ['text-gray-200', 'text-gray-800 dark:text-gray-200'],
];

reps.forEach(([find, rep]) => {
  const re = new RegExp(find.replace(/\[/g, '\\[').replace(/\]/g, '\\]') + '(?![\\w\\/])', 'g');
  c = c.replace(re, rep);
});

// Since `text-black dark:text-white/70` might be formed if we aren't careful,
// wait, `text-white` might match `text-white/70`?
// No, the negative lookahead `(?![\\w\\/])` prevents `text-white` matching `text-white/70`.

fs.writeFileSync('src/components/Reader.tsx', c);
