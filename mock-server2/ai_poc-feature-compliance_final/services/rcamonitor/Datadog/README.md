# Datadog Agent

AI agent for monitoring and analyzing metrics from Datadog.

## Setup

### 1. Install Dependencies

```bash
pip install datadog-api-client
```

### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
DD_API_KEY=your_api_key_here
DD_APP_KEY=your_application_key_here
DD_SITE=datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc.
```

### 3. Get API Keys

1. Go to [Datadog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
2. Create or copy an API Key
3. Go to [Datadog Application Keys](https://app.datadoghq.com/organization-settings/application-keys)
4. Create or copy an Application Key

## Usage

### Basic Example

```python
from agentic_systems.agents.Datadog.tools.datadog_api import DatadogClient
import time

# Initialize client
client = DatadogClient()

# Query metrics for the last hour
now = int(time.time())
one_hour_ago = now - 3600

cpu_metrics = client.query_metrics(
    query="avg:system.cpu.user{*}",
    from_time=one_hour_ago,
    to_time=now
)

print(cpu_metrics)
```

### Common Query Patterns

```python
from agentic_systems.agents.Datadog.tools.datadog_api import (
    DatadogClient,
    build_metric_query,
    COMMON_QUERIES
)

client = DatadogClient()

# Use predefined query
cpu_query = COMMON_QUERIES["cpu_usage"]

# Build custom query
api_latency_query = build_metric_query(
    metric="trace.http.request.duration",
    aggregation="p95",
    tags={"service": "api", "env": "production"},
    by=["endpoint"]
)

# Execute query
results = client.query_metrics(
    query=api_latency_query,
    from_time=one_hour_ago,
    to_time=now
)
```

## API Reference

See `tools/datadog_api.py` for detailed documentation.

### Key Classes

- `DatadogClient`: Main API client wrapper
  - `query_metrics()`: Query metric data
  - `search_logs()`: Search log entries (TODO)
  - `get_metric_metadata()`: Get metric metadata (TODO)

### Helper Functions

- `build_metric_query()`: Build metric query strings
- `COMMON_QUERIES`: Dictionary of common metric queries

## Resources

- [Datadog API Documentation](https://docs.datadoghq.com/api/latest/)
- [Datadog Python Client](https://github.com/DataDog/datadog-api-client-python)
- [Metric Query Language](https://docs.datadoghq.com/metrics/advanced-filtering/)
- [Log Search Syntax](https://docs.datadoghq.com/logs/search_syntax/)

## TODO

- [ ] Implement log search functionality
- [ ] Add event querying
- [ ] Add monitor/alerting integration
- [ ] Add dashboard API support
- [ ] Implement metric metadata retrieval
- [ ] Add rate limiting and retry logic
- [ ] Add caching for frequent queries
