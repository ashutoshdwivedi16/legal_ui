package com.lg.microservice.admin.domain.communication.service;

import java.util.Map;

/**
 * Service interface for Communication operations.
 * Proxies requests to the Communication microservice.
 */
public interface CommunicationService {

    // Template operations
    Object getTemplates(Integer page, Integer size, String sort, String status, String query);

    Object getTemplate(Long id);

    Object createTemplate(Map<String, Object> request);

    Object updateTemplate(Long id, Map<String, Object> request);

    Object deleteTemplate(Long id);

    Object previewTemplate(Long id, Map<String, Object> request);

    // Flow operations
    Object getFlows(Integer page, Integer size);

    Object getFlow(Long id);

    Object createFlow(Map<String, Object> request);

    Object updateFlow(Long id, Map<String, Object> request);

    Object deleteFlow(Long id);

    Object activateFlow(Long id, Map<String, Object> request);

    // Event operations
    Object getEventSources();

    Object getEventsMetadata(String eventSourceId);

    Object getEventGroups();

    Object getEventProperties(String id);

    // Flow execution operations
    Object getFlowExecutions(Integer page, Integer size, String sort, String flowId, String eventGroupId);

    Object getFlowExecution(Long id);

    Object getFlowExecutionAnalytics(String flowId, String eventGroupId);

    // Email stats
    Object getEmailStats(String startDate, String endDate);
}
