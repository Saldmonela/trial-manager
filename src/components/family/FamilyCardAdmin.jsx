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
  readOnly,
  onRequest,
  isHighlighted = false,
  forceExpand = false,
  highlightedEmail = null,
  connectedAccounts = [],
  onConnectDrive,
  onSyncDrive,
  onDisconnectDrive,
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
      readOnly={readOnly}
      onRequest={onRequest}
      isHighlighted={isHighlighted}
      forceExpand={forceExpand}
      highlightedEmail={highlightedEmail}
      connectedAccounts={connectedAccounts}
      onConnectDrive={onConnectDrive}
      onSyncDrive={onSyncDrive}
      onDisconnectDrive={onDisconnectDrive}
    />
  );
}
