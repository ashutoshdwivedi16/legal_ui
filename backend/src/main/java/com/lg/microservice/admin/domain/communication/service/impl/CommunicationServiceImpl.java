package com.lg.microservice.admin.domain.communication.service.impl;

import com.lg.microservice.admin.domain.communication.feign.CommunicationFeignClient;
import com.lg.microservice.admin.domain.communication.service.CommunicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@RequiredArgsConstructor
@Service
public class CommunicationServiceImpl implements CommunicationService {

    private final CommunicationFeignClient communicationFeignClient;

    @Override
    public Object getTemplates(Integer page, Integer size, String sort, String status, String query) {
        return communicationFeignClient.getTemplates(page, size, sort, status, query);
    }

    @Override
    public Object getTemplate(Long id) {
        return communicationFeignClient.getTemplate(id);
    }

    @Override
    public Object createTemplate(Map<String, Object> request) {
        return communicationFeignClient.createTemplate(request);
    }

    @Override
    public Object updateTemplate(Long id, Map<String, Object> request) {
        return communicationFeignClient.updateTemplate(id, request);
    }

    @Override
    public Object deleteTemplate(Long id) {
        return communicationFeignClient.deleteTemplate(id);
    }

    @Override
    public Object previewTemplate(Long id, Map<String, Object> request) {
        return communicationFeignClient.previewTemplate(id, request);
    }

    @Override
    public Object getFlows(Integer page, Integer size) {
        return communicationFeignClient.getFlows(page, size);
    }

    @Override
    public Object getFlow(Long id) {
        return communicationFeignClient.getFlow(id);
    }

    @Override
    public Object createFlow(Map<String, Object> request) {
        return communicationFeignClient.createFlow(request);
    }

    @Override
    public Object updateFlow(Long id, Map<String, Object> request) {
        return communicationFeignClient.updateFlow(id, request);
    }

    @Override
    public Object deleteFlow(Long id) {
        return communicationFeignClient.deleteFlow(id);
    }

    @Override
    public Object activateFlow(Long id, Map<String, Object> request) {
        return communicationFeignClient.activateFlow(id, request);
    }

    @Override
    public Object getEventSources() {
        return communicationFeignClient.getEventSources();
    }

    @Override
    public Object getEventsMetadata(String eventSourceId) {
        return communicationFeignClient.getEventsMetadata(eventSourceId);
    }

    @Override
    public Object getEventGroups() {
        return communicationFeignClient.getEventGroups();
    }

    @Override
    public Object getEventProperties(String id) {
        return communicationFeignClient.getEventProperties(id);
    }

    @Override
    public Object getFlowExecutions(Integer page, Integer size, String sort, String flowId, String eventGroupId) {
        return communicationFeignClient.getFlowExecutions(page, size, sort, flowId, eventGroupId);
    }

    @Override
    public Object getFlowExecution(Long id) {
        return communicationFeignClient.getFlowExecution(id);
    }

    @Override
    public Object getFlowExecutionAnalytics(String flowId, String eventGroupId) {
        return communicationFeignClient.getFlowExecutionAnalytics(flowId, eventGroupId);
    }

    @Override
    public Object getEmailStats(String startDate, String endDate) {
        return communicationFeignClient.getEmailStats(startDate, endDate);
    }
}
