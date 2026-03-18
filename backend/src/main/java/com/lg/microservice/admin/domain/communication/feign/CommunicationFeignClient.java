package com.lg.microservice.admin.domain.communication.feign;

import com.lg.microservice.admin.common.config.AuthorizationFeignInterceptor;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(
        name = "CommunicationFeignClient",
        url = "${microservice.communication}",
        configuration = AuthorizationFeignInterceptor.class
)
public interface CommunicationFeignClient {

    @GetMapping("/templates")
    Object getTemplates(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(value = "q", required = false) String query
    );

    @GetMapping("/templates/{id}")
    Object getTemplate(@PathVariable("id") Long id);

    @PostMapping("/templates")
    Object createTemplate(@RequestBody Map<String, Object> request);

    @PutMapping("/templates/{id}")
    Object updateTemplate(@PathVariable("id") Long id, @RequestBody Map<String, Object> request);

    @DeleteMapping("/templates/{id}")
    Object deleteTemplate(@PathVariable("id") Long id);

    @PostMapping("/templates/{id}/preview")
    Object previewTemplate(@PathVariable("id") Long id, @RequestBody Map<String, Object> request);

    @GetMapping("/flows")
    Object getFlows(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    );

    @GetMapping("/flows/{id}")
    Object getFlow(@PathVariable("id") Long id);

    @PostMapping("/flows")
    Object createFlow(@RequestBody Map<String, Object> request);

    @PutMapping("/flows/{id}")
    Object updateFlow(@PathVariable("id") Long id, @RequestBody Map<String, Object> request);

    @DeleteMapping("/flows/{id}/delete")
    Object deleteFlow(@PathVariable("id") Long id);

    @PutMapping("/flows/{id}/activate")
    Object activateFlow(@PathVariable("id") Long id, @RequestBody Map<String, Object> request);

    @GetMapping("/event-sources")
    Object getEventSources();

    @GetMapping("/events/metadata")
    Object getEventsMetadata(@RequestParam("eventSourceId") String eventSourceId);

    @GetMapping("/event-groups")
    Object getEventGroups();

    @GetMapping("/events/{id}/properties")
    Object getEventProperties(@PathVariable("id") String id);

    @GetMapping("/flow-executions")
    Object getFlowExecutions(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(value = "flow_id", required = false) String flowId,
            @RequestParam(value = "event_group_id", required = false) String eventGroupId
    );

    @GetMapping("/flow-executions/{id}")
    Object getFlowExecution(@PathVariable("id") Long id);

    @GetMapping("/flow-executions/analytics")
    Object getFlowExecutionAnalytics(
            @RequestParam(value = "flow_id", required = false) String flowId,
            @RequestParam(value = "event_group_id", required = false) String eventGroupId
    );

    @GetMapping("/api/email/stats")
    Object getEmailStats(
            @RequestParam("startDate") String startDate,
            @RequestParam("endDate") String endDate
    );
}
