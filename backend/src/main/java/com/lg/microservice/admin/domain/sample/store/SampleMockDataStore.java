package com.lg.microservice.admin.domain.sample.store;

import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.SampleItemStatus;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * In-memory data store for sample items.
 * Demonstrates a mock backend for the service proxy pattern.
 * Data resets on application restart.
 */
@Component
@Slf4j
public class SampleMockDataStore {
    
    private final Map<Long, SampleItemDto> items = new ConcurrentHashMap<>();
    private final AtomicLong idGenerator = new AtomicLong(0);
    
    @PostConstruct
    public void init() {
        log.info("Initializing SampleMockDataStore with sample data...");
        populateSampleData();
        log.info("SampleMockDataStore initialized with {} items", items.size());
    }
    
    private void populateSampleData() {
        String[] names = {
            "Widget Alpha", "Widget Beta", "Widget Gamma",
            "Gadget One", "Gadget Two", "Gadget Three",
            "Component X", "Component Y", "Component Z",
            "Module A", "Module B", "Module C",
            "Part 101", "Part 102", "Part 103"
        };
        
        String[] descriptions = {
            "High-performance widget for enterprise use",
            "Cost-effective solution for small businesses",
            "Premium grade component with warranty",
            "Standard issue module for general purposes",
            "Specialized part for specific applications",
            "Multi-purpose gadget with advanced features",
            "Entry-level component for beginners",
            "Professional grade equipment",
            "Industrial strength solution",
            "Eco-friendly alternative",
            "Next-generation technology",
            "Classic design with modern features",
            "Compact and portable option",
            "Heavy-duty industrial component",
            "Smart-enabled IoT device"
        };
        
        SampleItemStatus[] statuses = SampleItemStatus.values();
        Random random = new Random(42); // Fixed seed for reproducibility
        
        for (int i = 0; i < 15; i++) {
            SampleItemStatus status = statuses[random.nextInt(statuses.length)];
            create(new CreateSampleItemRequest(names[i], descriptions[i], status));
        }
    }
    
    /**
     * Find all items with pagination, sorting, and optional filtering.
     */
    public Page<SampleItemDto> findAll(Pageable pageable, String query, String status) {
        List<SampleItemDto> filtered = new ArrayList<>(items.values());

        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            try {
                SampleItemStatus statusEnum = SampleItemStatus.valueOf(status.toUpperCase());
                filtered = filtered.stream()
                        .filter(item -> item.status() == statusEnum)
                        .collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {
            }
        }

        if (query != null && !query.isBlank()) {
            String lowerQuery = query.toLowerCase();
            filtered = filtered.stream()
                    .filter(item ->
                            (item.name() != null && item.name().toLowerCase().contains(lowerQuery)) ||
                            (item.description() != null && item.description().toLowerCase().contains(lowerQuery)))
                    .collect(Collectors.toList());
        }

        if (pageable.getSort().isSorted()) {
            Comparator<SampleItemDto> comparator = null;
            for (org.springframework.data.domain.Sort.Order order : pageable.getSort()) {
                Comparator<SampleItemDto> fieldComparator = getFieldComparator(order.getProperty());
                if (fieldComparator != null) {
                    if (order.isDescending()) {
                        fieldComparator = fieldComparator.reversed();
                    }
                    comparator = comparator == null ? fieldComparator : comparator.thenComparing(fieldComparator);
                }
            }
            if (comparator != null) {
                filtered.sort(comparator);
            }
        } else {
            filtered.sort((a, b) -> Long.compare(b.id(), a.id()));
        }
        
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        
        if (start > filtered.size()) {
            return new PageImpl<>(Collections.emptyList(), pageable, filtered.size());
        }
        
        List<SampleItemDto> pageContent = filtered.subList(start, end);
        return new PageImpl<>(pageContent, pageable, filtered.size());
    }

    private Comparator<SampleItemDto> getFieldComparator(String field) {
        return switch (field) {
            case "id" -> Comparator.comparingLong(SampleItemDto::id);
            case "name" -> Comparator.comparing(SampleItemDto::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "status" -> Comparator.comparing(item -> item.status().name());
            case "createdAt" -> Comparator.comparing(SampleItemDto::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "updatedAt" -> Comparator.comparing(SampleItemDto::updatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> null;
        };
    }
    
    /**
     * Find item by ID.
     */
    public Optional<SampleItemDto> findById(Long id) {
        return Optional.ofNullable(items.get(id));
    }
    
    /**
     * Create a new item.
     */
    public SampleItemDto create(CreateSampleItemRequest request) {
        Long id = idGenerator.incrementAndGet();
        SampleItemDto item = SampleItemDto.create(
                id,
                request.name(),
                request.description(),
                request.getEffectiveStatus()
        );
        items.put(id, item);
        log.debug("Created sample item: {}", item);
        return item;
    }
    
    /**
     * Update an existing item.
     */
    public Optional<SampleItemDto> update(Long id, UpdateSampleItemRequest request) {
        SampleItemDto existing = items.get(id);
        if (existing == null) {
            return Optional.empty();
        }

        SampleItemDto updated = existing.withUpdates(
                request.name(),
                request.description(),
                request.status()
        );
        items.put(id, updated);
        log.debug("Updated sample item: {}", updated);
        return Optional.of(updated);
    }
    
    /**
     * Delete an item.
     */
    public boolean delete(Long id) {
        SampleItemDto removed = items.remove(id);
        if (removed != null) {
            log.debug("Deleted sample item: {}", id);
            return true;
        }
        return false;
    }
    
    /**
     * Check if item exists.
     */
    public boolean exists(Long id) {
        return items.containsKey(id);
    }
    
    /**
     * Get total count.
     */
    public long count() {
        return items.size();
    }

    /**
     * Delete multiple items by IDs.
     */
    public int deleteItems(List<Long> ids) {
        int deleted = 0;
        for (Long id : ids) {
            if (items.remove(id) != null) {
                deleted++;
            }
        }
        log.debug("Bulk deleted {} sample items", deleted);
        return deleted;
    }
}
