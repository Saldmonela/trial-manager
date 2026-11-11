import React, { useState } from 'react';
import { invokeApi } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
export default function MigrationTool({onSuccess}) {
  const { t } = useLanguage();
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [confirmed,setConfirmed]=useState(false);
  const migrate=async()=>{
    if(!confirmed||busy)return;setBusy(true);setMessage('');
    try{
      const rows=JSON.parse(localStorage.getItem('google-ai-families')||'[]');
      if(!Array.isArray(rows)||!rows.length)throw new Error('Tidak ada data lokal.');
      for(const row of rows){
        // Explicit import: existing identities are never overwritten on retry.
        const result=await invokeApi('save-family',{id:row.id,name:row.name||'',ownerEmail:row.ownerEmail,ownerPassword:row.ownerPassword,
          expiryDate:row.expiryDate||'',storageUsed:Number(row.storageUsed)||0,notes:row.notes||'',
          priceMonthly:Number(row.priceMonthly)||0,priceAnnual:Number(row.priceAnnual)||0,priceSale:Number(row.priceSale)||0,currency:row.currency||'IDR',productType:row.productType||'slot',operation:'create',
          members:(row.members||[]).map(m=>({...m,storageUsed:Number(m.storageUsed)||0,memberType:m.memberType||'pembeli'}))});
        if(!result.success)throw new Error(result.error||'Import gagal. Data lokal tetap disimpan.');
      }
      setMessage('Import selesai. Data lokal tetap disimpan untuk pemulihan.');onSuccess?.();
    }catch(error){setMessage(error instanceof Error?error.message:'Import gagal.');}finally{setBusy(false);}
  };
  return (
    <section className="space-y-4 border border-stone-300 p-5 dark:border-stone-800">
      <h2 className="font-serif text-xl font-bold">{t('admin.migration.title')}</h2>
      <p className="text-sm opacity-70">{t('admin.migration.desc')}</p>
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy} className="mt-0.5 h-4 w-4 accent-gold-600"/>
        {t('admin.migration.confirm')}
      </label>
      <button type="button" onClick={migrate} disabled={!confirmed||busy} className="border border-stone-900 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-stone-900 hover:text-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-400 dark:hover:bg-stone-50 dark:hover:text-stone-950">
        {busy ? t('admin.migration.submitting') : t('admin.migration.submit')}
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
