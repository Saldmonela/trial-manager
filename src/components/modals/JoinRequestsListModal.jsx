import React, { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useJoinRequests } from '../../hooks/useSupabaseData';
import Modal from './Modal';
import { cn } from '../../utils';
import { Check, X, Clock, Mail } from 'lucide-react';

export default function JoinRequestsListModal({ isOpen, onClose }) {
  const { theme } = useTheme();
  const { joinRequests, loading, updateStatus, refetch } = useJoinRequests();

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleStatusUpdate = async (requestId, newStatus) => {
    await updateStatus(requestId, newStatus);
  };

  const pendingRequests = joinRequests.filter(req => req.status === 'pending');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pending Join Requests" maxWidth="max-w-2xl">
      {loading ? (
        <div className="text-center py-8 opacity-50 font-serif italic">Loading requests...</div>
      ) : pendingRequests.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-none">
          <p className={cn("font-serif italic", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
            No pending requests found.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div
              key={request.id}
              className={cn(
                "p-4 border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center",
                theme === 'light' ? "bg-stone-50 border-stone-200" : "bg-stone-900 border-stone-800"
              )}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className={cn("font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
                    {request.name}
                  </h4>
                  <span className={cn("text-xs px-2 py-0.5 border rounded-full uppercase tracking-wider", 
                    theme === 'light' ? "bg-stone-100 border-stone-200 text-stone-500" : "bg-stone-800 border-stone-700 text-stone-400"
                  )}>
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm opacity-70">
                  <Mail className="w-3 h-3" />
                  <span>{request.email}</span>
                </div>

                {request.note && (
                  <div className={cn("mt-2 text-sm italic p-2 border-l-2", 
                    theme === 'light' ? "border-stone-300 bg-stone-100/50" : "border-stone-700 bg-stone-800/50"
                  )}>
                    "{request.note}"
                  </div>
                )}
                
                <div className="text-xs uppercase tracking-widest opacity-50 mt-1">
                  Requested Family ID: {request.familyId.slice(0, 8)}...
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => handleStatusUpdate(request.id, 'rejected')}
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2 border text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors",
                    theme === 'light' ? "border-stone-200 text-stone-500" : "border-stone-700 text-stone-400"
                  )}
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => handleStatusUpdate(request.id, 'approved')}
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2 border text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors",
                    theme === 'light' 
                      ? "bg-stone-900 text-stone-50 border-stone-900 hover:bg-stone-800" 
                      : "bg-stone-50 text-stone-900 border-stone-50 hover:bg-stone-200"
                  )}
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
