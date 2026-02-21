import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useJoinRequests, useAppSetting } from '../../hooks/useSupabaseData';
import { useToast } from '../../hooks/useToast';
import Modal from './Modal';
import { cn } from '../../utils';
import { Check, X, Mail, MessageCircle, Package, Clock, CheckCircle2, History } from 'lucide-react';
import ToastContainer from '../ui/ToastContainer';

export default function OrderManagementModal({ isOpen, onClose }) {
  const { theme } = useTheme();
  const { joinRequests, loading, updateStatus, refetch } = useJoinRequests();
  const { toasts, addToast, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const { value: upgradePrice } = useAppSetting('upgrade_service_price', 45000);

  // Enrich upgrade orders with the global price (they have no family, so price is 0)
  const enrichedRequests = useMemo(() => 
    joinRequests.map(r => 
      r.productType === 'account_custom' && !r.familyId
        ? { ...r, priceSale: Number(upgradePrice) || 0 }
        : r
    ),
  [joinRequests, upgradePrice]);

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleStatusUpdate = async (requestId, newStatus, request) => {
    const result = await updateStatus(requestId, newStatus);
    if (result?.success !== false) {
      if (newStatus === 'approved') {
        addToast(`✅ Order dari ${request.name} berhasil di-approve!`, 'success');
      } else if (newStatus === 'rejected') {
        addToast(`❌ Order dari ${request.name} ditolak.`, 'error');
      }
    } else {
      addToast(`Gagal update status: ${result?.error || 'Unknown error'}`, 'error');
    }
  };

  const handleWhatsAppClick = (request) => {
    const isOneTime = request.billingCycle === 'one_time' || request.productType === 'account_ready' || request.productType === 'account_custom';
    
    const cycleText = isOneTime ? 'Lifetime' : (request.billingCycle === 'annual' ? 'Tahunan' : 'Bulanan');
    const price = isOneTime 
      ? (request.priceSale || 0)
      : (request.billingCycle === 'annual' ? request.priceAnnual : request.priceMonthly);
    
    let productLabel = 'Subscription';
    if (request.productType === 'account_ready') productLabel = 'Akun Siap Pakai';
    if (request.productType === 'account_custom') productLabel = 'Upgrade Akun';

    const message = `Halo ${request.name}, terima kasih sudah order ${productLabel} ${request.familyName} (${cycleText}) seharga ${(price || 0).toLocaleString('id-ID')}. Pembayaran sudah saya terima dan akun akan segera diproses.`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const pendingRequests = useMemo(() => enrichedRequests.filter(req => req.status === 'pending'), [enrichedRequests]);
  const completedRequests = useMemo(() => enrichedRequests.filter(req => req.status === 'approved' || req.status === 'rejected' || req.status === 'cancelled'), [enrichedRequests]);

  const isDark = theme === 'dark';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Order Management" maxWidth="max-w-3xl">
        {/* Tab Navigation */}
        <div className={cn("flex border-b mb-6", isDark ? "border-stone-800" : "border-stone-200")}>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest font-bold transition-colors border-b-2 -mb-px",
              activeTab === 'pending'
                ? isDark ? "border-gold-500 text-gold-500" : "border-stone-900 text-stone-900"
                : isDark ? "border-transparent text-stone-500 hover:text-stone-300" : "border-transparent text-stone-400 hover:text-stone-600"
            )}
          >
            <Clock className="w-4 h-4" />
            Pending
            {pendingRequests.length > 0 && (
              <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest font-bold transition-colors border-b-2 -mb-px",
              activeTab === 'completed'
                ? isDark ? "border-gold-500 text-gold-500" : "border-stone-900 text-stone-900"
                : isDark ? "border-transparent text-stone-500 hover:text-stone-300" : "border-transparent text-stone-400 hover:text-stone-600"
            )}
          >
            <History className="w-4 h-4" />
            History
            <span className={cn("ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
              isDark ? "bg-stone-800 text-stone-400" : "bg-stone-100 text-stone-500"
            )}>
              {completedRequests.length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 opacity-50 font-serif italic">Loading orders...</div>
        ) : activeTab === 'pending' ? (
          // ========== PENDING TAB ==========
          pendingRequests.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-none">
              <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-3", isDark ? "text-emerald-500" : "text-emerald-600")} />
              <p className={cn("font-serif italic", isDark ? "text-stone-500" : "text-stone-400")}>
                All clear! No pending orders.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <OrderCard
                  key={request.id}
                  request={request}
                  theme={theme}
                  isDark={isDark}
                  onApprove={() => handleStatusUpdate(request.id, 'approved', request)}
                  onReject={() => handleStatusUpdate(request.id, 'rejected', request)}
                  onWhatsApp={() => handleWhatsAppClick(request)}
                />
              ))}
            </div>
          )
        ) : (
          // ========== COMPLETED TAB ==========
          completedRequests.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-none">
              <p className={cn("font-serif italic", isDark ? "text-stone-500" : "text-stone-400")}>
                No order history yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedRequests.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "p-4 border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between",
                    isDark ? "bg-stone-900/50 border-stone-800" : "bg-stone-50 border-stone-200"
                  )}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm",
                        request.status === 'approved'
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
                          : request.status === 'cancelled'
                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                            : "bg-red-500/15 text-red-400 border border-red-500/20"
                      )}>
                        {request.status === 'approved' ? '✅ Paid' : request.status === 'cancelled' ? '↩️ Sale Cancelled' : '❌ Rejected'}
                      </span>
                      <h4 className={cn("font-bold", isDark ? "text-stone-200" : "text-stone-800")}>
                        {request.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5 opacity-60">
                        <Mail className="w-3 h-3" />
                        <span>{request.email}</span>
                      </div>
                      <span className="opacity-30">•</span>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <Package className="w-3 h-3" />
                        <span>{request.familyName}</span>
                        {request.productType && request.productType !== 'slot' && (
                          <span className={cn(
                            "text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border",
                            request.productType === 'account_ready'
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                          )}>
                            {request.productType === 'account_ready' ? 'Ready' : 'Upgrade'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn("text-right text-xs whitespace-nowrap", isDark ? "text-stone-500" : "text-stone-400")}>
                    {new Date(request.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Modal>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

// Extracted OrderCard component for pending orders
function OrderCard({ request, theme, isDark, onApprove, onReject, onWhatsApp }) {
  const isOneTime = request.billingCycle === 'one_time' || request.productType === 'account_ready' || request.productType === 'account_custom';
  const price = isOneTime
    ? (request.priceSale || 0)
    : (request.billingCycle === 'annual' ? (request.priceAnnual || 0) : (request.priceMonthly || 0));

  return (
    <div className={cn("p-4 border", isDark ? "bg-stone-900 border-stone-800" : "bg-stone-50 border-stone-200")}>
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        {/* Order Details */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <h4 className={cn("font-bold text-lg", isDark ? "text-stone-50" : "text-stone-900")}>
              {request.name}
            </h4>
            <span className={cn("text-xs px-2 py-0.5 border rounded-full uppercase tracking-wider",
              isDark ? "bg-stone-800 border-stone-700 text-stone-400" : "bg-stone-100 border-stone-200 text-stone-500"
            )}>
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Product Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border",
              isDark ? "bg-black border-stone-700" : "bg-white border-stone-200"
            )}>
              <Package className="w-4 h-4 opacity-50" />
              <span className="font-bold">{request.familyName}</span>
              {request.productType && request.productType !== 'slot' && (
                <span className={cn(
                  "ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                  request.productType === 'account_ready'
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                )}>
                  {request.productType === 'account_ready' ? 'Ready Account' : 'Upgrade'}
                </span>
              )}
            </div>
            <div className={cn("font-serif font-bold text-lg", isDark ? "text-gold-400" : "text-stone-900")}>
              Rp {price.toLocaleString('id-ID')}
              <span className="text-xs font-sans font-normal opacity-50 ml-1">
                /{isOneTime ? 'one time' : (request.billingCycle === 'annual' ? 'yr' : 'mo')}
              </span>
              <span className={cn(
                "ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border align-middle",
                isOneTime
                  ? "bg-stone-500/10 text-stone-500 border-stone-500/20"
                  : request.billingCycle === 'annual'
                    ? "bg-gold-500/10 text-gold-500 border-gold-500/20"
                    : "bg-stone-500/10 text-stone-500 border-stone-500/20"
              )}>
                {isOneTime ? 'LIFETIME' : (request.billingCycle === 'annual' ? 'Annual' : 'Monthly')}
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex items-center gap-2 text-sm opacity-70">
            <Mail className="w-3 h-3" />
            <span>{request.email}</span>
          </div>

          {/* Note */}
          {request.note && (
            <div className={cn("mt-2 text-sm italic p-3 border-l-2",
              isDark ? "border-stone-700 bg-stone-800/50" : "border-stone-300 bg-stone-100/50"
            )}>
              "{request.note}"
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full md:w-48 sticky top-4">
          <button
            onClick={onWhatsApp}
            className="w-full px-4 py-2 border border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Chat Buyer
          </button>

          <div className="h-px bg-stone-200 dark:bg-stone-800 my-1" />

          <button
            onClick={onApprove}
            className={cn(
              "w-full px-4 py-3 border text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors",
              isDark
                ? "bg-stone-50 text-stone-900 border-stone-50 hover:bg-stone-200"
                : "bg-stone-900 text-stone-50 border-stone-900 hover:bg-stone-800"
            )}
          >
            <Check className="w-4 h-4" />
            Mark as Paid
          </button>

          <button
            onClick={onReject}
            className={cn(
              "w-full px-4 py-2 border text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors",
              isDark ? "border-stone-700 text-stone-400" : "border-stone-200 text-stone-500"
            )}
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
