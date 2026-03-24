'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { SurveyQuestion } from '@/lib/types';
import { SURVEY_QUESTION_LIBRARY } from '@/lib/survey-questions';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Save,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuestionLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_LABELS: Record<SurveyQuestion['type'], string> = {
  star: '⭐ Estrellas',
  emoji: '😊 Emojis',
  text: '✏️ Texto',
};

const TYPE_CYCLE: SurveyQuestion['type'][] = ['star', 'emoji', 'text'];

// ─── Component ───────────────────────────────────────────────────────────────

export function QuestionLibraryDialog({
  open,
  onOpenChange,
}: QuestionLibraryDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // Firestore doc ref
  const docRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'configuration', 'surveyQuestions') : null),
    [firestore],
  );
  const { data: firestoreDoc, isLoading } = useDoc<{ questions: SurveyQuestion[] }>(docRef);

  // Local editing state
  const [localQuestions, setLocalQuestions] = useState<SurveyQuestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);

  // Add-question inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<SurveyQuestion['type']>('star');
  const [newRequired, setNewRequired] = useState(true);

  // Initialise local questions from Firestore or fallback
  useEffect(() => {
    if (!open) return;
    if (isLoading) return;

    if (firestoreDoc?.questions?.length) {
      setLocalQuestions(firestoreDoc.questions);
    } else {
      setLocalQuestions([...SURVEY_QUESTION_LIBRARY]);
    }
  }, [open, isLoading, firestoreDoc]);

  // Reset transient state when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setShowAddForm(false);
      setNewText('');
      setNewType('star');
      setNewRequired(true);
    }
  }, [open]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const moveQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setLocalQuestions((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const updateQuestion = useCallback(
    (id: string, patch: Partial<SurveyQuestion>) => {
      setLocalQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      );
    },
    [],
  );

  const cycleType = useCallback((id: string, currentType: SurveyQuestion['type']) => {
    const idx = TYPE_CYCLE.indexOf(currentType);
    const nextType = TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length];
    updateQuestion(id, { type: nextType });
  }, [updateQuestion]);

  const deleteQuestion = useCallback(
    (id: string) => {
      if (localQuestions.length <= 1) {
        toast({
          title: 'No se puede eliminar',
          description: 'Debe haber al menos una pregunta en la biblioteca.',
          variant: 'destructive',
        });
        return;
      }
      setLocalQuestions((prev) => prev.filter((q) => q.id !== id));
    },
    [localQuestions.length, toast],
  );

  const startEditing = useCallback((q: SurveyQuestion) => {
    setEditingId(q.id);
    setEditingText(q.text);
  }, []);

  const commitEditing = useCallback(() => {
    if (editingId && editingText.trim()) {
      updateQuestion(editingId, { text: editingText.trim() });
    }
    setEditingId(null);
    setEditingText('');
  }, [editingId, editingText, updateQuestion]);

  const addQuestion = useCallback(() => {
    if (!newText.trim()) return;
    const q: SurveyQuestion = {
      id: `custom_${Date.now()}`,
      text: newText.trim(),
      type: newType,
      required: newRequired,
    };
    setLocalQuestions((prev) => [...prev, q]);
    setNewText('');
    setNewType('star');
    setNewRequired(true);
    setShowAddForm(false);
  }, [newText, newType, newRequired]);

  const handleSave = useCallback(async () => {
    if (!docRef) return;
    setSaving(true);
    try {
      await setDoc(docRef, { questions: localQuestions });
      toast({
        title: 'Biblioteca guardada',
        description: 'Las preguntas se actualizaron correctamente.',
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving question library:', err);
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [docRef, localQuestions, toast, onOpenChange]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl shadow-card">
        <DialogHeader>
          <DialogTitle>Biblioteca de Preguntas</DialogTitle>
          <DialogDescription>
            Administra las preguntas disponibles para tus encuestas.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable question list */}
        <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {localQuestions.map((q, index) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, 'up')}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === localQuestions.length - 1}
                      onClick={() => moveQuestion(index, 'down')}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Question text — inline editing */}
                  <div className="flex-1 min-w-0">
                    {editingId === q.id ? (
                      <Input
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditing();
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditingText('');
                          }
                        }}
                        className="h-8 text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-left truncate w-full hover:underline cursor-text"
                        onClick={() => startEditing(q)}
                      >
                        {q.text}
                      </button>
                    )}
                  </div>

                  {/* Type badge (clickable to cycle) */}
                  <button
                    type="button"
                    className="px-2 py-0.5 text-xs rounded-full bg-muted hover:bg-muted/70 transition-colors whitespace-nowrap shrink-0"
                    onClick={() => cycleType(q.id, q.type)}
                    title="Clic para cambiar tipo"
                  >
                    {TYPE_LABELS[q.type]}
                  </button>

                  {/* Required toggle */}
                  <Switch
                    checked={q.required}
                    onCheckedChange={(val) => updateQuestion(q.id, { required: val })}
                    className="shrink-0"
                  />

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteQuestion(q.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add question inline form */}
              {showAddForm ? (
                <div className="flex flex-col gap-3 p-3 rounded-lg border border-dashed bg-muted/20">
                  <Input
                    autoFocus
                    placeholder="Escribe la pregunta..."
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newText.trim()) addQuestion();
                      if (e.key === 'Escape') setShowAddForm(false);
                    }}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Type selector */}
                    <div className="flex gap-1">
                      {TYPE_CYCLE.map((t) => (
                        <Button
                          key={t}
                          variant={newType === t ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setNewType(t)}
                        >
                          {TYPE_LABELS[t]}
                        </Button>
                      ))}
                    </div>

                    {/* Required checkbox */}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <Switch
                        checked={newRequired}
                        onCheckedChange={setNewRequired}
                      />
                      Obligatoria
                    </label>

                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewText('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!newText.trim()}
                        onClick={addQuestion}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar pregunta
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
