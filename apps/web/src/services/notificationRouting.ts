import { Notification, UserRole } from '../types';

export function inferNotificationEntityType(relatedEntityId?: string): string | undefined {
  if (!relatedEntityId) return undefined;
  if (relatedEntityId.startsWith('OFR-')) return 'Offer';
  if (relatedEntityId.startsWith('REQ-')) return 'Request';
  if (relatedEntityId.startsWith('TXN-')) return 'Transaction';
  if (relatedEntityId.startsWith('CASE-')) return 'Case';
  if (relatedEntityId.startsWith('MATCH-')) return 'Match';
  if (relatedEntityId.startsWith('ASSET-')) return 'ContainerAsset';
  return undefined;
}

export function resolveNotificationEntityType(notification: Notification): string | undefined {
  return inferNotificationEntityType(notification.relatedEntityId) || notification.relatedEntityType;
}

export function getNotificationTab(notification: Notification, currentRole: UserRole): string | undefined {
  const entityType = resolveNotificationEntityType(notification);
  switch (entityType) {
    case 'Transaction':
      return 'transactions';
    case 'Offer':
      return 'offers';
    case 'Request':
      return 'requests';
    case 'Case':
      return 'cases';
    case 'ContainerAsset':
      return currentRole === 'OPS' ? 'assets' : 'offers';
    case 'Match':
      return currentRole === 'ENTERPRISE_B' ? 'requests' : 'offers';
    default:
      return undefined;
  }
}
