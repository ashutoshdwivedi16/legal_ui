package com.lg.microservice.admin.domain.sample.feign;

import com.lg.microservice.admin.common.config.AuthorizationFeignInterceptor;
import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.domain.sample.dto.BulkDeleteRequest;
import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(
        name = "SampleFeignClient",
        url = "${microservice.sample}",
        configuration = AuthorizationFeignInterceptor.class
)
public interface SampleFeignClient {

    @GetMapping("/items")
    PageResponse<SampleItemDto> getItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "id,desc") String sort
    );

    @GetMapping("/items/{id}")
    DataResponse<SampleItemDto> getItem(@PathVariable("id") Long id);

    @PostMapping("/items")
    DataResponse<SampleItemDto> createItem(@RequestBody CreateSampleItemRequest request);

    @PutMapping("/items/{id}")
    DataResponse<SampleItemDto> updateItem(
            @PathVariable("id") Long id,
            @RequestBody UpdateSampleItemRequest request
    );

    @DeleteMapping("/items/{id}")
    void deleteItem(@PathVariable("id") Long id);

    @DeleteMapping("/items")
    void deleteItems(@RequestBody BulkDeleteRequest request);

}
