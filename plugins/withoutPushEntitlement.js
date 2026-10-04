// expo-notifications always adds the Push Notifications entitlement
// (aps-environment). SpendWise only schedules local reminders, which don't
// need it, and free Apple developer accounts can't sign apps that have it.
// Listed first in app.json: plugins later in the list modify the entitlements
// earlier, so the first one sees the final file.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
