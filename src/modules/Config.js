export const CONFIG = {
    SCRIPT_ID: "ig-analyzer",
    SCRIPT_NAME: "Instagram Follower Analyzer",
    BACKUP_SCHEMA_VERSION: 2,
    STORAGE_KEY: "ig_snapshot_v2",
    POSITION_KEY: "ig_panel_position_v2",
    WHITELIST_KEY: "ig_whitelist_v2",
    HISTORY_KEY: "ig_history_v2",
    CHURN_KEY: "ig_churn_v3",
    DEACTIVATED_KEY: "ig_deactivated_v3",
    BLOCKED_KEY: "ig_blocked_v1",
    TOUR_KEY: "ig_tour_completed_v1",
    RENAMED_KEY: "ig_renamed_v1",
    NEW_FOLLOWERS_KEY: "ig_new_followers_v1",
    TARGET_TRACKER_KEY: "ig_target_tracker_v1",
    TARGET_SUBPANEL_POSITION_KEY: "ig_target_position_v1",
    STORY_ANOMALY_KEY: "ig_story_anomaly_v1",
    STORY_OBS_KEY: "ig_story_observations_v1",
    STORY_MIN_OBSERVATIONS: 3,
    STORY_MIN_ANOMALIES_FOR_FLAG: 2,
    STORY_STREAK_FOR_MEDIUM_CONFIDENCE: 2,
    FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
    FOLLOWING_ALT_HASH: "3dec7e2c57367ef3da3d987d89f9dbc8",
    FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
    HIGHLIGHTS_HASH: "d4d88dc1500312af6f937f7b804c68c3",
    EXTRACTION_ENGINE_KEY: "ig_extraction_engine_v1",
    DEFAULT_EXTRACTION_ENGINE: "hybrid",
    PAGE_SIZE: 50,
    FRIENDSHIPS_PAGE_SIZE: 12,     // Native Instagram Web modal batch size (?count=12)
    GRAPHQL_FOLLOW_LIST_PAGE_SIZE: 20, // Native Relay usePolarisGetFollowListQuery batch size (first: 20)
    HYBRID_RECONCILE_THRESHOLD: 0.92,  // Reconcile via GraphQL when REST coverage drops below 92%
    HYBRID_MIN_MISSING_USERS: 6,       // Minimum missing accounts to avoid extra passes for 1-5 deactivated users
    RELAY_DOC_IDS: {
        FOLLOW_LIST_QUERY: "40819242737691319",         // usePolarisGetFollowListQuery
        FOLLOW_LIST_WRAPPER_QUERY: "26750505977951904", // PolarisFollowListContentWrapperQuery
        PROFILE_QUERY: "28036671149327607",             // PolarisProfilePageContentQuery (proven variables)
        PROFILE_ALT_QUERY: "40158838120366999",         // PolarisProfilePageContentQuery (live bundle fallback)
        HIGHLIGHTS_TRAY_QUERY: "26970053832668570",     // PolarisProfileStoryHighlightsTrayContentQuery
        HOVER_CARD_QUERY: "28949219061332276",          // PolarisUserHoverCardContentV2Query
        SEARCH_BOX_QUERY: "27706427925724183",          // PolarisSearchBoxRefetchableQuery
        SEARCH_BOX_NON_PROFILED_QUERY: "27634848489527274"
    },
    FRIENDSHIPS_RATE_LIMIT_MS: 1400, // Natural scroll pacing for paginated requests
    BASE_RATE_LIMIT_MS: 2000, // Increased pacing for native REST API sensitivity
    MAX_RETRIES: 4,           
    COOLDOWN_429_MS: 60000,   // Cooldown period when encountering HTTP 429
    RATE_LIMIT_STATE_KEY: "ig_rate_limit_buckets_v1",
    RATE_LIMIT_CIRCUIT_MS: 300000,
    BREATHER_EVERY_PAGES: 8,       // Insert human scroll breather every 8 cumulative pages
    BREATHER_PAUSE_MS: 3200,       // Extra breather duration (ms)
    MAX_AUTO_VERIFY_ACCOUNTS: 5, // Maximum lost accounts to auto-verify per scan
    ASBD_ID: "359341",        // Modern Meta ASBD header identifier
    DEBUG: false,
    MIN_VISIBLE_PX: 50,
    DEFAULT_POSITION: { top: 80, right: 20, width: 717, height: 560 }
};