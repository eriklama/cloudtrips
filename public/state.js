/* =========================
 * CONFIG / STATE
 * ========================= */

const API = {
  GET_TRIPS: '/api/getTrips',
  GET_TRIP: '/api/getTrip',
  SAVE_TRIP_META: '/api/saveTripMeta',
  UPSERT_ACTIVITY: '/api/upsertActivity',
  DELETE_ACTIVITY: '/api/deleteActivity',
  REORDER_ACTIVITIES: '/api/reorderActivities',
  DELETE_TRIP: '/api/deleteTrip',
  SHARE_TRIP: '/api/shareTrip',
  GET_SHARES: '/api/getShares',
  REVOKE_SHARE: '/api/revokeShare',
  DISABLE_SHARE: '/api/disableShare'
};

const state = {
  trips: [],
  tripsLoaded: false,
  currentTrip: null,
  editingActivityId: null,
  timelineCollapsedDays: new Set(),
  timelineView: 'timeline'
};