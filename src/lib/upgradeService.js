/**
 * Utility function to construct the static Premium Upgrade Service object.
 */
export function getUpgradeServiceObject({
  upgradePriceSettings,
  serviceTitle,
  serviceDesc,
  serviceFeaturesRaw,
  paymentType,
  validity
}) {
  let features = [];
  try {
    features = typeof serviceFeaturesRaw === 'string' ? JSON.parse(serviceFeaturesRaw) : serviceFeaturesRaw;
  } catch (e) {
    features = ['Private Account', 'Full Warranty', 'Instant Activation'];
  }

  return {
    id: 'upgrade-service',
    familyName: 'Premium Upgrade',
    serviceName: 'Premium Upgrade',
    name: 'Premium Upgrade',
    notes: serviceTitle,
    description: serviceDesc,
    features: features,
    paymentType: paymentType,
    validity: validity,
    productType: 'account_custom',
    priceSale: upgradePriceSettings,
    currency: 'IDR',
    expiryDate: null,
    storageUsed: 0,
    slotsAvailable: 99,
  };
}
