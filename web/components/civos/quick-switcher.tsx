'use client';
import { useEffect, useState } from 'react';
import { Search, FileText, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { kinds, type Entry } from '@/lib/model';
export function QuickSwitcher({
  entries,
  onOpen,
  onGraph,
}: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
  onGraph: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return (
    <>
      <Button
        className="quick-search"
        aria-label="Search documents"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <Search size={15} />
        <span>Search documents…</span>
        <kbd>Ctrl K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Open document"
        description="Search by title or record type. Use the arrow keys to navigate and Enter to open."
      >
        <Command>
          <CommandInput placeholder="Search documents or views…" />
          <CommandList>
            <CommandEmpty>No documents found.</CommandEmpty>
            <CommandGroup heading="Views">
              <CommandItem
                onSelect={() => {
                  onGraph();
                  setOpen(false);
                }}
              >
                <Network />
                Open reference graph
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Documents">
              {entries.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.id + ' ' + kinds[e.kind].label + ' ' + e.data.title}
                  onSelect={() => {
                    onOpen(e);
                    setOpen(false);
                  }}
                >
                  <FileText />
                  <span>{String(e.data.title)}</span>
                  <small>{kinds[e.kind].label}</small>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
