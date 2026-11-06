import React, { useState, useEffect } from 'react';
import {
  X,
  FilePlus,
  FolderPlus,
  Edit3,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Button from './ui/Button';

export interface CreateModalProps {
  isOpen: boolean;
  type: 'file' | 'folder';
  parentDir: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export const CreateFileOrFolderModal: React.FC<CreateModalProps> = ({
  isOpen,
  type,
  parentDir,
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`Please enter a valid ${type} name.`);
      return;
    }

    if (/[<>:"|?*]/.test(trimmed)) {
      setError('Name cannot contain invalid characters (<>:"|?*).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to create ${type}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {type === 'file' ? <FilePlus className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">
                New {type === 'file' ? 'File' : 'Folder'}
              </h3>
              <p className="text-[10px] text-[#747982] truncate max-w-xs font-mono">{parentDir}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#747982] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#ECEDEF]">
              {type === 'file' ? 'File Name' : 'Folder Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={type === 'file' ? 'e.g. index.ts or components/App.tsx' : 'e.g. utils'}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white placeholder-[#747982] font-mono transition-colors"
            />
            {type === 'file' && (
              <p className="text-[10px] text-[#747982]">
                Supports nested paths (e.g. <span className="text-[#A4A8AF] font-mono">src/services/api.ts</span>).
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Creating...' : `Create ${type === 'file' ? 'File' : 'Folder'}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  isDirectory: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  isDirectory,
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }

    if (trimmed === currentName) {
      onClose();
      return;
    }

    if (/[<>:"/\\|?*]/.test(trimmed)) {
      setError('Name cannot contain invalid characters (<>:"/\\|?*).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to rename item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Edit3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">
                Rename {isDirectory ? 'Folder' : 'File'}
              </h3>
              <p className="text-[10px] text-[#747982] truncate max-w-xs font-mono">{currentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#747982] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#ECEDEF]">New Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-white/25 focus:outline-none text-xs text-white font-mono transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface DeleteModalProps {
  isOpen: boolean;
  itemName: string;
  isDirectory: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteModalProps> = ({
  isOpen,
  itemName,
  isDirectory,
  onClose,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Delete Confirmation</h3>
              <p className="text-[10px] text-[#747982]">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#747982] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-rose-500/[0.05] border border-rose-500/15 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#ECEDEF] leading-relaxed">
              <span>Are you sure you want to permanently delete </span>
              <strong className="text-white font-mono">{itemName}</strong>
              {isDirectory && (
                <span className="text-[#A4A8AF]"> and all of its contents?</span>
              )}
              {!isDirectory && <span>?</span>}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="py-1.5 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Permanently</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
