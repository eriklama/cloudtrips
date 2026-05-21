/* =========================
 * CONFIG / STATE
 * ========================= */

const API = {
  GET_TRIPS: '/api/getTrips',
  GET_TRIP: '/api/getTrip',
  GET_STATS: '/api/getStats',
  GET_ERRORS: '/api/getErrors',
  GET_VISITED_COUNTRIES: '/api/getVisitedCountries',
  SAVE_VISITED_COUNTRIES: '/api/saveVisitedCountries',
  GET_USER_SETTINGS: '/api/getUserSettings',
  SAVE_USER_SETTINGS: '/api/saveUserSettings',
  GET_PDF_USAGE: '/api/getPdfUsage',
  GET_TRIP_MEMBERS: '/api/getTripMembers',
  INVITE_MEMBER: '/api/inviteMember',
  REMOVE_MEMBER: '/api/removeMember',
  SAVE_TRIP_META: '/api/saveTripMeta',
  DUPLICATE_TRIP: '/api/duplicateTrip',
  UPSERT_ACTIVITY: '/api/upsertActivity',
  DELETE_ACTIVITY: '/api/deleteActivity',
  REORDER_ACTIVITIES: '/api/reorderActivities',
  DELETE_TRIP: '/api/deleteTrip',
  SHARE_TRIP: '/api/shareTrip',
  GET_SHARES: '/api/getShares',
  REVOKE_SHARE: '/api/revokeShare',
  DISABLE_SHARE: '/api/disableShare',
  DELETE_ACCOUNT: '/api/deleteAccount',
  RESEND_VERIFICATION: '/api/resendVerification',
  VERIFY_EMAIL: '/api/verifyEmail'
};

const state = {
  trips: [],
  tripsLoaded: false,
  tripsPage: 1,
  tripsHasMore: false,
  currentTrip: null,
  editingActivityId: null,
  collapsedActivityDays: new Set(),
  timelineCollapsedDays: new Set(),
  timelineView: 'timeline',
  settings: {
    defaultCurrency: ''
  }
};