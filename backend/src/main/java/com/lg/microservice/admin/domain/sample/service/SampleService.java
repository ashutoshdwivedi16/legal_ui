package com.lg.microservice.admin.domain.sample.service;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import java.util.List;

public interface SampleService {

    PageResponse<SampleItemDto> getItems(int page, int size, String query, String status, String sort);

    DataResponse<SampleItemDto> getItem(Long id);

    DataResponse<SampleItemDto> createItem(CreateSampleItemRequest request);

    DataResponse<SampleItemDto> updateItem(Long id, UpdateSampleItemRequest request);

    void deleteItem(Long id);

    void deleteItems(List<Long> ids);
}
