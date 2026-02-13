import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

const INITIAL_FORM = {
  name: '',
  email: '',
  note: '',
};

export default function JoinRequestModal({ isOpen, onClose, familyName, onSubmit }) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFormData(INITIAL_FORM);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      name: formData.name.trim(),
      email: formData.email.trim(),
      note: formData.note.trim(),
    });
    setIsSubmitting(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Join Request${familyName ? `: ${familyName}` : ''}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Your name"
          required
        />

        <FormField
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="you@example.com"
          required
        />

        <div>
          <label
            className={cn(
              'block text-xs uppercase tracking-widest font-medium mb-2',
              theme === 'light' ? 'text-stone-500' : 'text-stone-400'
            )}
          >
            Note (Optional)
          </label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
            rows={3}
            placeholder="Anything the admin should know"
            className={cn(
              'w-full px-4 py-3 border bg-transparent focus:outline-none transition-colors resize-none',
              theme === 'light'
                ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900'
                : 'border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50'
            )}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-50',
            theme === 'light'
              ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
              : 'bg-stone-50 text-stone-900 hover:bg-stone-200'
          )}
        >
          {isSubmitting ? 'Sending...' : 'Send Request'}
        </button>
      </form>
    </Modal>
  );
}
