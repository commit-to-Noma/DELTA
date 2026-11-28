import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

export interface SpecItem { label: string; value: string }

export const DataModelSpecsDrawer: React.FC<{ items: SpecItem[]; children?: React.ReactNode }> = ({ items, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-onyx-900 border border-onyx-800 rounded">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-mono text-storm-300 hover:text-white">
        <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold">
          <Info className="w-3.5 h-3.5 text-storm-400" />
          Data &amp; Model Specs
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-onyx-800 space-y-2 text-[11px] text-storm-300">
          {items.map((item) => (
            <div key={item.label}>
              <span className="font-mono text-[10px] text-storm-400 uppercase block">{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
          {children}
        </div>
      )}
    </div>
  );
};
