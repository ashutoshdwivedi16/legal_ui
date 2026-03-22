"""
Datadog API Client and Utilities

This module provides a wrapper around the Datadog API for querying metrics,
logs, and events.

Official Datadog API Documentation:
https://docs.datadoghq.com/api/latest/

Required Environment Variables:
- DD_API_KEY: Datadog API Key
- DD_APP_KEY: Datadog Application Key
- DD_SITE: Datadog site (e.g., 'datadoghq.com', 'datadoghq.eu')
"""

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v1.api.metrics_api import MetricsApi
from datadog_api_client.v2.api.logs_api import LogsApi
import os
from typing import Optional, Dict, Any, List

note = """

{
    "status": "ok",
    "res_type": "time_series",
    "resp_version": 1,
    "query": "sum:trace.http.request.errors{service:micro-fe-lg-support-b2c-prd,env:prd}.as_rate()",
    "from_date": 1770074801000,
    "to_date": 1770075201000,
    "series": [
        {
            "aggr": "sum",
            "attributes": {},
            "display_name": "trace.http.request.errors",
            "end": 1770075209000,
            "expression": "sum:trace.http.request.errors{env:prd,service:micro-fe-lg-support-b2c-prd}.as_rate()",
            "interval": 10,
            "length": 36,
            "metric": "trace.http.request.errors",
            "pointlist": [
                [
                    1770074810000.0,
                    0.3
                ],
                [
                    1770074820000.0,
                    0.5
                ],
                [
                    1770074830000.0,
                    0.4
                ],
                [
                    1770074840000.0,
                    0.2
                ],
                [
                    1770074850000.0,
                    0.7
                ],
                [
                    1770074860000.0,
                    0.7
                ],
                [
                    1770074880000.0,
                    0.2
                ],
                [
                    1770074890000.0,
                    0.4
                ],
                [
                    1770074900000.0,
                    0.1
                ],
                [
                    1770074920000.0,
                    0.1
                ],
                [
                    1770074930000.0,
                    0.5
                ],
                [
                    1770074940000.0,
                    0.3
                ],
                [
                    1770074950000.0,
                    0.6
                ],
                [
                    1770074960000.0,
                    0.7
                ],
                [
                    1770074980000.0,
                    0.2
                ],
                [
                    1770074990000.0,
                    0.7
                ],
                [
                    1770075000000.0,
                    0.4
                ],
                [
                    1770075010000.0,
                    0.9
                ],
                [
                    1770075020000.0,
                    0.3
                ],
                [
                    1770075030000.0,
                    0.4
                ],
                [
                    1770075040000.0,
                    0.1
                ],
                [
                    1770075050000.0,
                    0.5
                ],
                [
                    1770075060000.0,
                    0.1
                ],
                [
                    1770075070000.0,
                    0.2
                ],
                [
                    1770075080000.0,
                    0.2
                ],
                [
                    1770075100000.0,
                    0.2
                ],
                [
                    1770075110000.0,
                    0.4
                ],
                [
                    1770075120000.0,
                    0.7
                ],
                [
                    1770075130000.0,
                    0.1
                ],
                [
                    1770075140000.0,
                    0.4
                ],
                [
                    1770075150000.0,
                    0.2
                ],
                [
                    1770075160000.0,
                    0.4
                ],
                [
                    1770075170000.0,
                    0.1
                ],
                [
                    1770075180000.0,
                    0.4
                ],
                [
                    1770075190000.0,
                    0.1
                ],
                [
                    1770075200000.0,
                    0.5
                ]
            ],
            "query_index": 0,
            "scope": "env:prd,service:micro-fe-lg-support-b2c-prd",
            "start": 1770074810000,
            "tag_set": [],
            "unit": [
                {
                    "family": "general",
                    "name": "error",
                    "plural": "errors",
                    "scale_factor": 1.0,
                    "short_name": "err",
                    "id": 44
                },
                {
                    "family": "time",
                    "name": "second",
                    "plural": "seconds",
                    "scale_factor": 1.0,
                    "short_name": "s",
                    "id": 11
                }
            ]
        }
    ],
    "values": [],
    "times": [],
    "message": "",
    "group_by": []
}
"""
data_dog_api= """
Note:
maximum 1000 monitors can be returned per request

Monitor:
https://api.datadoghq.com/api/v1/monitor?group_states=alert: Get all alert (group_states=alert) monitors
https://api.datadoghq.com/api/v1/monitor/{id}?group_states=alert : Get a specific monitor by ID with alert state
https://api.datadoghq.com/api/v1/monitor?group_states=alert&type=watchdog: Get all alert monitors of type watchdog

Events:
https://api.datadoghq.com/api/v1/events?start=1770237153&end=1770323553&tags=env:prd,monitor
https://api.datadoghq.com/api/v1/events?start=1770237153&end=1770323553&tags=env:prd,source:watchdog

https://api.datadoghq.com/api/v1/events?start=1770071553&end=1770075153&tags=env:prd,source:watchdog

alert_type: "error", "warning", "info", "success"

Metrics
https://api.datadoghq.com/api/v1/metrics/query?from=1770002643&to=1770261843&query=avg:system.cpu.user{*}: Query metrics (CPU usage) over a time range

https://api.datadoghq.com/api/v1/query?from=1770074801&to=1770075201&query=sum:trace.http.request.hits{service:micro-fe-lg-support-b2c-prd,env:prd}.as_rate()

https://api.datadoghq.com/api/v1/logs-queries/list: Post request to search logs with a query


"""
class DatadogClient:
    """
    Datadog API client wrapper for common operations.
    
    Usage:
        client = DatadogClient()
        metrics = client.query_metrics(
            query="avg:system.cpu.user{*}",
            from_time=1609459200,
            to_time=1609545600
        )
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        app_key: Optional[str] = None,
        site: Optional[str] = None
    ):
        """
        Initialize Datadog client.
        
        Args:
            api_key: Datadog API key (defaults to DD_API_KEY env var)
            app_key: Datadog Application key (defaults to DD_APP_KEY env var)
            site: Datadog site (defaults to DD_SITE env var or 'datadoghq.com')
        """
        self.api_key = api_key or os.getenv("DD_API_KEY")
        self.app_key = app_key or os.getenv("DD_APP_KEY")
        self.site = site or os.getenv("DD_SITE", "datadoghq.com")
        
        if not self.api_key or not self.app_key:
            raise ValueError("DD_API_KEY and DD_APP_KEY must be set")
        
        self.configuration = Configuration()
        self.configuration.api_key["apiKeyAuth"] = self.api_key
        self.configuration.api_key["appKeyAuth"] = self.app_key
        self.configuration.server_variables["site"] = self.site
        
        self.api_client = ApiClient(self.configuration)
    
    def query_metrics(
        self,
        query: str,
        from_time: int,
        to_time: int
    ) -> Dict[str, Any]:
        """
        Query Datadog metrics.
        
        Args:
            query: Metric query string (e.g., "avg:system.cpu.user{*}")
            from_time: Start time (Unix timestamp in seconds)
            to_time: End time (Unix timestamp in seconds)
            
        Returns:
            Metric query results
            
        Example:
            >>> client.query_metrics(
            ...     query="avg:system.cpu.user{host:web-server}",
            ...     from_time=1609459200,
            ...     to_time=1609545600
            ... )
        """
        with self.api_client as api_client:
            api_instance = MetricsApi(api_client)
            response = api_instance.query_metrics(
                _from=from_time,
                to=to_time,
                query=query
            )
            return response.to_dict()
    
    def search_logs(
        self,
        query: str,
        from_time: str,
        to_time: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Search Datadog logs.
        
        Args:
            query: Log search query (e.g., "service:web-app status:error")
            from_time: Start time (ISO 8601 format)
            to_time: End time (ISO 8601 format)
            limit: Maximum number of logs to return
            
        Returns:
            List of log entries
            
        Example:
            >>> client.search_logs(
            ...     query="service:api status:error",
            ...     from_time="2024-01-01T00:00:00Z",
            ...     to_time="2024-01-01T23:59:59Z",
            ...     limit=50
            ... )
        """
        # TODO: Implement log search using LogsApi
        raise NotImplementedError("Log search not yet implemented")
    
    def get_metric_metadata(self, metric_name: str) -> Dict[str, Any]:
        """
        Get metadata for a specific metric.
        
        Args:
            metric_name: Name of the metric
            
        Returns:
            Metric metadata
        """
        # TODO: Implement metric metadata retrieval
        raise NotImplementedError("Metric metadata retrieval not yet implemented")


# Common Datadog Query Patterns
COMMON_QUERIES = {
    "cpu_usage": "avg:system.cpu.user{*}",
    "memory_usage": "avg:system.mem.used{*}",
    "disk_usage": "avg:system.disk.used{*}",
    "network_in": "avg:system.net.bytes_rcvd{*}",
    "network_out": "avg:system.net.bytes_sent{*}",
    "api_latency": "avg:trace.http.request.duration{*}",
    "error_rate": "sum:trace.http.request.errors{*}.as_count()",
    "request_count": "sum:trace.http.request.hits{*}.as_count()",
}


def build_metric_query(
    metric: str,
    aggregation: str = "avg",
    tags: Optional[Dict[str, str]] = None,
    by: Optional[List[str]] = None
) -> str:
    """
    Build a Datadog metric query string.
    
    Args:
        metric: Metric name (e.g., "system.cpu.user")
        aggregation: Aggregation function (avg, sum, min, max, etc.)
        tags: Filter tags as dict (e.g., {"host": "web-1", "env": "prod"})
        by: Group by tags (e.g., ["host", "service"])
        
    Returns:
        Formatted query string
        
    Example:
        >>> build_metric_query(
        ...     metric="system.cpu.user",
        ...     aggregation="avg",
        ...     tags={"env": "production"},
        ...     by=["host"]
        ... )
        'avg:system.cpu.user{env:production} by {host}'
    """
    tag_str = "*"
    if tags:
        tag_parts = [f"{k}:{v}" for k, v in tags.items()]
        tag_str = ",".join(tag_parts)
    
    query = f"{aggregation}:{metric}{{{tag_str}}}"
    
    if by:
        by_str = ",".join(by)
        query += f" by {{{by_str}}}"
    
    return query


# Usage Examples
"""
# Initialize client
client = DatadogClient()

# Query CPU metrics for the last hour
import time
now = int(time.time())
one_hour_ago = now - 3600

cpu_data = client.query_metrics(
    query="avg:system.cpu.user{*}",
    from_time=one_hour_ago,
    to_time=now
)

# Build custom query
query = build_metric_query(
    metric="trace.http.request.duration",
    aggregation="p95",
    tags={"service": "api", "env": "production"},
    by=["endpoint"]
)

latency_data = client.query_metrics(
    query=query,
    from_time=one_hour_ago,
    to_time=now
)
"""
