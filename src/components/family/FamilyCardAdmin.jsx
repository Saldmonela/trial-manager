import React from 'react';
import FamilyCard from './FamilyCard';

export default function FamilyCardAdmin({ family, onDelete, onEdit, onAddMember, onRemoveMember, onCancelSale, pendingOrders, onApproveOrder, onRejectOrder, readOnly, onRequest }) {
  return (
    <FamilyCard
      family={family}
      onDelete={onDelete}
      onEdit={onEdit}
      onAddMember={onAddMember}
      onRemoveMember={onRemoveMember}
      onCancelSale={onCancelSale}
      pendingOrders={pendingOrders}
      onApproveOrder={onApproveOrder}
      onRejectOrder={onRejectOrder}
      readOnly={readOnly}
      onRequest={onRequest}
    />
  );
}
