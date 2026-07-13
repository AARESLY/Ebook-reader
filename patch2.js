const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const searchStr = `        {modalBook && (
          <ExpandedBookModal`;

const replaceStr = `        {customizeShelfId && (
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
          <ExpandedBookModal`;

if (code.includes(searchStr)) {
  code = code.replace(searchStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('patched return block successfully');
} else {
  console.log('could not find search string');
}
