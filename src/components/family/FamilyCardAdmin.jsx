import React from 'react';
import FamilyCard from './FamilyCard';

export default function FamilyCardAdmin({ family, onDelete, onEdit, onAddMember, onRemoveMember }) {
  return (
    <FamilyCard
      family={family}
      onDelete={onDelete}
      onEdit={onEdit}
      onAddMember={onAddMember}
      onRemoveMember={onRemoveMember}
    />
  );
}
