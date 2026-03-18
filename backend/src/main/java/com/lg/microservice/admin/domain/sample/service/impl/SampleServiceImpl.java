package com.lg.microservice.admin.domain.sample.service.impl;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.domain.sample.dto.BulkDeleteRequest;
import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.feign.SampleFeignClient;
import com.lg.microservice.admin.domain.sample.service.SampleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
@Service
public class SampleServiceImpl implements SampleService {

    private final SampleFeignClient sampleFeignClient;

    @Override
    public PageResponse<SampleItemDto> getItems(int page, int size, String query, String status, String sort) {
        return sampleFeignClient.getItems(page, size, query, status, sort);
    }

    @Override
    public DataResponse<SampleItemDto> getItem(Long id) {
        return sampleFeignClient.getItem(id);
    }

    @Override
    public DataResponse<SampleItemDto> createItem(CreateSampleItemRequest request) {
        return sampleFeignClient.createItem(request);
    }

    @Override
    public DataResponse<SampleItemDto> updateItem(Long id, UpdateSampleItemRequest request) {
        return sampleFeignClient.updateItem(id, request);
    }

    @Override
    public void deleteItem(Long id) {
        sampleFeignClient.deleteItem(id);
    }

    @Override
    public void deleteItems(List<Long> ids) {
        sampleFeignClient.deleteItems(new BulkDeleteRequest(ids));
    }
}
