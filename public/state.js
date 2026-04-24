  /* =========================
   * CONFIG / STATE
   * ========================= */

  const API = {
    GET_TRIPS: '/api/getTrips',
    GET_TRIP: '/api/getTrip',
    SAVE_TRIP: '/api/saveTrip',
    DELETE_TRIP: '/api/deleteTrip',
    SHARE_TRIP: '/api/shareTrip'
  };

  const state = {
    trips: [],
    currentTrip: null,
    editingActivityId: null,
    timelineCollapsedDays: new Set(),
    timelineView: 'timeline'
  };