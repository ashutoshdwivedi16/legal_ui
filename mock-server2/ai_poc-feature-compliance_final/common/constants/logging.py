"""
Centralized constants for structured logging.
Makes it easier to maintain consistent event names and service identifiers.
"""

# ============================================================================
# Logging Levels (matching Python logging module)
# ============================================================================
DEBUG = "DEBUG"
INFO = "INFO"
WARNING = "WARNING"
ERROR = "ERROR"


# ============================================================================
# Service Types
# ============================================================================
SERVICE_API = "api"
SERVICE_DATABASE = "database"
SERVICE_KPI_MONITOR_AGENT = "kpi_monitor_agent"


# ============================================================================
# Agent Identifiers
# ============================================================================
AGENT_ORCHESTRATOR = "agent_orchestrator"
AGENT_RETAIL_MONITOR = "agent_retail_monitor"
AGENT_INVENTORY = "agent_inventory"
AGENT_AKAMAI = "agent_akamai"
AGENT_AWS = "agent_aws"
AGENT_COVEO = "agent_coveo"
AGENT_GA4 = "agent_ga4"
AGENT_NEWRELIC = "agent_newrelic"


# ============================================================================
# Event Types - Investigation
# ============================================================================
INVESTIGATION_STARTED = "investigation_started"
INVESTIGATION_COMPLETED = "investigation_completed"
INVESTIGATION_FAILED = "investigation_failed"

AGENT_DELEGATED = "agent_delegated"
AGENT_EXECUTION_STARTED = "agent_execution_started"
AGENT_EXECUTION_COMPLETED = "agent_execution_completed"
AGENT_EXECUTION_FAILED = "agent_execution_failed"


# ============================================================================
# Event Types - Tools
# ============================================================================
TOOL_EXECUTION_STARTED = "tool_execution_started"
TOOL_EXECUTION_COMPLETED = "tool_execution_completed"
TOOL_EXECUTION_FAILED = "tool_execution_failed"

COMPETITOR_PRICING_CHECK = "competitor_pricing_check"
PRICING_CHANGES_CHECK = "pricing_changes_check"
INVENTORY_CHECK = "inventory_check"
STOCKOUT_CHECK = "stockout_check"
WAREHOUSE_CHECK = "warehouse_check"


# ============================================================================
# Event Types - Database
# ============================================================================
DATABASE_INIT = "database_init"
DATABASE_INIT_COMPLETE = "database_init_complete"
DATABASE_INIT_FAILED = "database_init_failed"
DATABASE_QUERY = "database_query"
DATABASE_INSERT = "database_insert"
DATABASE_UPDATE = "database_update"
DATABASE_DELETE = "database_delete"
DATABASE_ERROR = "database_error"


# ============================================================================
# Event Types - API
# ============================================================================
API_STARTUP = "api_startup"
API_SHUTDOWN = "api_shutdown"
API_REQUEST_RECEIVED = "api_request_received"
API_REQUEST_COMPLETED = "api_request_completed"
API_REQUEST_FAILED = "api_request_failed"
API_HEALTH_CHECK = "api_health_check"


# ============================================================================
# Event Types - LLM
# ============================================================================
LLM_REQUEST_STARTED = "llm_request_started"
LLM_REQUEST_COMPLETED = "llm_request_completed"
LLM_REQUEST_FAILED = "llm_request_failed"
LLM_TOKEN_USAGE = "llm_token_usage"
