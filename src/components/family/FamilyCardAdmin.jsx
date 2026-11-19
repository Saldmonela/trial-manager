import React from 'react';
import FamilyCard from './FamilyCard';

export default function FamilyCardAdmin({
  family,
  allFamilies = [],
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
  cockpitAccounts = [],
  historyEntries = [],
  cooldownLocks = [],
  cooldownByEmail = null,
  historyLoading = false,
  historyError = null,
  onRetryHistory,
  onOpenHistory,
  onTogglePlanStatus,
  onMigrateAccount,
}) {
  return (
    <FamilyCard
      family={family}
      allFamilies={allFamilies}
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
      cockpitAccounts={cockpitAccounts}
      historyEntries={historyEntries}
      cooldownLocks={cooldownLocks}
      cooldownByEmail={cooldownByEmail}
      historyLoading={historyLoading}
      historyError={historyError}
      onRetryHistory={onRetryHistory}
      onOpenHistory={onOpenHistory}
      onTogglePlanStatus={onTogglePlanStatus}
      onMigrateAccount={onMigrateAccount}
    />
  );
}
