import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { HardDrive, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils';
import { encryptPassword } from '../lib/crypto';

export default function MigrationTool({ onSuccess }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [status, setStatus] = useState('idle'); // idle, migrating, success, error
  const [log, setLog] = useState('');

  const handleMigrate = async () => {
    try {
      setStatus('migrating');
      if (!supabase) {
        setLog('Supabase Client not configured. Check your .env file.');
        setStatus('error');
        return;
      }

      setLog('Reading LocalStorage...');
      
      const rawData = window.localStorage.getItem('google-ai-families');
      if (!rawData) {
        setLog('No data found in LocalStorage.');
        setStatus('error');
        return;
      }

      const families = JSON.parse(rawData);
      setLog(`Found ${families.length} families. Starting upload...`);

      // Get stable encryption key (user.id)
      const { data: { user } } = await supabase.auth.getUser();
      const encryptionKey = user?.id || '';

      for (const family of families) {
        // Encrypt password before storing
        const encryptedPassword = await encryptPassword(family.ownerPassword, encryptionKey);

        // Insert Family
        const { error: familyError } = await supabase
          .from('families')
          .upsert({ // upsert to avoid duplicates if re-run
            id: family.id,
            user_id: user?.id,
            name: family.name,
            owner_email: family.ownerEmail,
            owner_password: encryptedPassword,
            expiry_date: family.expiryDate,
            storage_used: Number(family.storageUsed) || 0,
            notes: family.notes,
            created_at: family.createdAt
          });

        if (familyError) throw familyError;

        // Insert Members
        if (family.members && family.members.length > 0) {
           const membersToInsert = family.members.map(m => ({
             id: m.id,
             family_id: family.id,
             name: m.name,
             email: m.email,
             added_at: m.addedAt
           }));

           const { error: memberError } = await supabase
             .from('members')
             .upsert(membersToInsert); // upsert members
            
           if (memberError) throw memberError;
        }
      }

      setLog('Migration complete! All data from your local browser is now synced to Supabase Cloud.');
      setStatus('success');
      
      // Clear the old data from localStorage since it's now safe in the cloud
      window.localStorage.removeItem('google-ai-families');

      if (onSuccess) {
        setTimeout(onSuccess, 3000); 
      }

    } catch (error) {
      console.error(error);
      setLog(`Error: ${error.message || 'Unknown error'}`);
      setStatus('error');
    }
  };

  if (status === 'success') {
     return null; // Hide after success
  }

  return (
    <div className={cn(
      "border-b p-4 flex items-center justify-between",
      theme === 'light' ? "bg-amber-50 border-amber-200" : "bg-amber-900/10 border-amber-900/30"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn("p-2 rounded-full", theme === 'light' ? "bg-amber-100 text-amber-600" : "bg-amber-900/30 text-amber-500")}>
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <h4 className={cn("font-bold text-sm", theme === 'light' ? "text-amber-900" : "text-amber-500")}>
            {t('common.migration_title')}
          </h4>
          <p className={cn("text-xs opacity-90", theme === 'light' ? "text-amber-800" : "text-amber-200")}>
            {status === 'idle' && t('common.migration_desc')}
             {status === 'migrating' && log}
             {status === 'error' && log}
          </p>
        </div>
      </div>

      <button
        onClick={handleMigrate}
        disabled={status === 'migrating'}
        className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors flex items-center gap-2",
            theme === 'light' 
              ? "bg-amber-500 text-white hover:bg-amber-600" 
              : "bg-amber-600 text-white hover:bg-amber-500",
            status === 'migrating' && "opacity-70 cursor-wait"
        )}
      >
        {status === 'migrating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        {status === 'migrating' ? t('common.moving_btn') : t('common.migrate_btn')}
      </button>
    </div>
  );
}
