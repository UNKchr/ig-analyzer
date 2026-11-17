export const UI = {
    // Modal State
    currentHdUser: null,
    hdModalAbortController: null,

    // List & Pagination State
    paginationState: {},
    whitelistSearchQuery: '',

    // Target Tracker State
    currentTargetUser: null,
    targetPaginationState: {},

    // Interactive SVG Chart State (per scope)
    chartState: {
        main: { metric: 'followers', range: '30d' },
        target: { metric: 'followers', range: '30d' }
    }
};
