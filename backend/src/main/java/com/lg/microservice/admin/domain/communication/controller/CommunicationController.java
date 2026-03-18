package com.lg.microservice.admin.domain.communication.controller;

import com.lg.microservice.admin.domain.communication.service.CommunicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/v1/communication")
@RequiredArgsConstructor
@Tag(name = "Communication Service", description = "Proxy to Communication microservice for email templates, flows, and transactions")
public class CommunicationController {

    private final CommunicationService communicationService;

    @Operation(summary = "List email templates")
    @PreAuthorize("hasAuthority('communication.templates:read')")
    @GetMapping("/templates")
    public ResponseEntity<Object> getTemplates(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(value = "q", required = false) String query) {
        return ResponseEntity.ok(communicationService.getTemplates(page, size, sort, status, query));
    }

    @Operation(summary = "Get email template by ID")
    @PreAuthorize("hasAuthority('communication.templates:read')")
    @GetMapping("/templates/{id}")
    public ResponseEntity<Object> getTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(communicationService.getTemplate(id));
    }

    @Operation(summary = "Create email template")
    @PreAuthorize("hasAuthority('communication.templates:create')")
    @PostMapping("/templates")
    public ResponseEntity<Object> createTemplate(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.createTemplate(request));
    }

    @Operation(summary = "Update email template")
    @PreAuthorize("hasAuthority('communication.templates:update')")
    @PutMapping("/templates/{id}")
    public ResponseEntity<Object> updateTemplate(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.updateTemplate(id, request));
    }

    @Operation(summary = "Delete email template")
    @PreAuthorize("hasAuthority('communication.templates:delete')")
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Object> deleteTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(communicationService.deleteTemplate(id));
    }

    @Operation(summary = "Preview email template with data")
    @PreAuthorize("hasAuthority('communication.templates:read')")
    @PostMapping("/templates/{id}/preview")
    public ResponseEntity<Object> previewTemplate(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.previewTemplate(id, request));
    }

    @Operation(summary = "List flows")
    @PreAuthorize("hasAuthority('communication.flows:read')")
    @GetMapping("/flows")
    public ResponseEntity<Object> getFlows(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(communicationService.getFlows(page, size));
    }

    @Operation(summary = "Get flow by ID")
    @PreAuthorize("hasAuthority('communication.flows:read')")
    @GetMapping("/flows/{id}")
    public ResponseEntity<Object> getFlow(@PathVariable Long id) {
        return ResponseEntity.ok(communicationService.getFlow(id));
    }

    @Operation(summary = "Create flow")
    @PreAuthorize("hasAuthority('communication.flows:create')")
    @PostMapping("/flows")
    public ResponseEntity<Object> createFlow(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.createFlow(request));
    }

    @Operation(summary = "Update flow")
    @PreAuthorize("hasAuthority('communication.flows:update')")
    @PutMapping("/flows/{id}")
    public ResponseEntity<Object> updateFlow(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.updateFlow(id, request));
    }

    @Operation(summary = "Delete flow")
    @PreAuthorize("hasAuthority('communication.flows:delete')")
    @DeleteMapping("/flows/{id}/delete")
    public ResponseEntity<Object> deleteFlow(@PathVariable Long id) {
        return ResponseEntity.ok(communicationService.deleteFlow(id));
    }

    @Operation(summary = "Activate/deactivate flow")
    @PreAuthorize("hasAuthority('communication.flows:update')")
    @PutMapping("/flows/{id}/activate")
    public ResponseEntity<Object> activateFlow(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(communicationService.activateFlow(id, request));
    }

    @Operation(summary = "List event sources")
    @PreAuthorize("hasAuthority('communication.events:read')")
    @GetMapping("/event-sources")
    public ResponseEntity<Object> getEventSources() {
        return ResponseEntity.ok(communicationService.getEventSources());
    }

    @Operation(summary = "Get events metadata by source")
    @PreAuthorize("hasAuthority('communication.events:read')")
    @GetMapping("/events/metadata")
    public ResponseEntity<Object> getEventsMetadata(@RequestParam("eventSourceId") String eventSourceId) {
        return ResponseEntity.ok(communicationService.getEventsMetadata(eventSourceId));
    }

    @Operation(summary = "List event groups")
    @PreAuthorize("hasAuthority('communication.events:read')")
    @GetMapping("/event-groups")
    public ResponseEntity<Object> getEventGroups() {
        return ResponseEntity.ok(communicationService.getEventGroups());
    }

    @Operation(summary = "Get event properties")
    @PreAuthorize("hasAuthority('communication.events:read')")
    @GetMapping("/events/{id}/properties")
    public ResponseEntity<Object> getEventProperties(@PathVariable String id) {
        return ResponseEntity.ok(communicationService.getEventProperties(id));
    }

    @Operation(summary = "List flow executions")
    @PreAuthorize("hasAuthority('communication.flow-executions:read')")
    @GetMapping("/flow-executions")
    public ResponseEntity<Object> getFlowExecutions(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(value = "flow_id", required = false) String flowId,
            @RequestParam(value = "event_group_id", required = false) String eventGroupId) {
        return ResponseEntity.ok(communicationService.getFlowExecutions(page, size, sort, flowId, eventGroupId));
    }

    @Operation(summary = "Get flow execution by ID")
    @PreAuthorize("hasAuthority('communication.flow-executions:read')")
    @GetMapping("/flow-executions/{id}")
    public ResponseEntity<Object> getFlowExecution(@PathVariable Long id) {
        return ResponseEntity.ok(communicationService.getFlowExecution(id));
    }

    @Operation(summary = "Get flow execution analytics")
    @PreAuthorize("hasAuthority('communication.flow-executions:read')")
    @GetMapping("/flow-executions/analytics")
    public ResponseEntity<Object> getFlowExecutionAnalytics(
            @RequestParam(value = "flow_id", required = false) String flowId,
            @RequestParam(value = "event_group_id", required = false) String eventGroupId) {
        return ResponseEntity.ok(communicationService.getFlowExecutionAnalytics(flowId, eventGroupId));
    }

    @Operation(summary = "Get email statistics")
    @PreAuthorize("hasAuthority('communication.email:read')")
    @GetMapping("/email/stats")
    public ResponseEntity<Object> getEmailStats(
            @RequestParam("startDate") String startDate,
            @RequestParam("endDate") String endDate) {
        return ResponseEntity.ok(communicationService.getEmailStats(startDate, endDate));
    }
}
