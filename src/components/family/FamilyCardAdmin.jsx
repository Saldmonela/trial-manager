import React from 'react';
import FamilyCard from './FamilyCard';

export default function FamilyCardAdmin({
  family,
  onDelete,
  onEdit,
  onAddMember,
  onRemoveMember,
  onEditMember,
  onCancelSale,
  pendingOrders,
  onApproveOrder,
  onRejectOrder,
  readOnly,
  onRequest,
  isHighlighted = false,
  forceExpand = false,
  highlightedEmail = null,
}) {
  return (
    <FamilyCard
      family={family}
      onDelete={onDelete}
      onEdit={onEdit}
      onAddMember={onAddMember}
      onRemoveMember={onRemoveMember}
      onEditMember={onEditMember}
      onCancelSale={onCancelSale}
      pendingOrders={pendingOrders}
      onApproveOrder={onApproveOrder}
      onRejectOrder={onRejectOrder}
      readOnly={readOnly}
      onRequest={onRequest}
      isHighlighted={isHighlighted}
      forceExpand={forceExpand}
      highlightedEmail={highlightedEmail}
    />
  );
}
