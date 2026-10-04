// Org Fleet is click-to-explore: a role chip opens what fills it (or, for a missing
// role, ships that would); a member opens their fleet next to the rest of the org;
// two members can be compared side by side. This is what's open right now.
export const ui = $state({ role: null, member: null, a: null, b: null });
