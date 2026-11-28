import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  testId?: string;
  children: React.ReactNode;
}

/** Closed-by-default collapsible section, matching DataModelSpecsDrawer styling. */
export const Accordion: React.FC<AccordionProps> = ({ title, defaultOpen = false, testId, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-onyx-900 border border-onyx-800 rounded" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-mono text-storm-300 hover:text-white"
      >
        <span className="uppercase tracking-wider font-bold">{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 border-t border-onyx-800">{children}</div>}
    </div>
  );
};
