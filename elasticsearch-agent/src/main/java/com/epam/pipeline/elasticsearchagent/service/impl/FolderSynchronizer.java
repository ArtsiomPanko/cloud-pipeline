package com.epam.pipeline.elasticsearchagent.service.impl;

import com.epam.pipeline.elasticsearchagent.dao.PipelineEventDao;
import com.epam.pipeline.elasticsearchagent.model.FolderDoc;
import com.epam.pipeline.elasticsearchagent.model.PipelineEvent;
import com.epam.pipeline.elasticsearchagent.repository.FolderRepo;
import com.epam.pipeline.elasticsearchagent.service.ElasticsearchSynchronizer;
import com.epam.pipeline.elasticsearchagent.utils.EventProcessorUtils;
import com.epam.pipeline.entity.pipeline.Folder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
@Service
public class FolderSynchronizer implements ElasticsearchSynchronizer {
    private final PipelineEventDao pipelineEventDao;
    private final PipelineEvent.ObjectType objectType = PipelineEvent.ObjectType.FOLDER;
    private final CloudPipelineAPIClient client;
    private final FolderRepo folderRepo;

    @Override
    public void synchronize(final LocalDateTime lastSyncTime, final LocalDateTime syncStart) {
        log.debug("Starting to synchronize {} entities", objectType);
        final List<PipelineEvent> pipelineEvents = pipelineEventDao
                .loadPipelineEventsByObjectType(objectType, syncStart);

        log.debug("Loaded {} events for {}", pipelineEvents.size(), objectType);
        final List<PipelineEvent> mergeEvents = EventProcessorUtils.mergeEvents(pipelineEvents);
        if (mergeEvents.isEmpty()) {
            log.debug("{} entities for synchronization were not found.", objectType);
            return;
        }

        log.debug("Merged {} events for {}", mergeEvents.size(), objectType);

        //process merge events

        //load Folders using cloudPipelineApi;
        //client.loadPipelineFolder(id)

        mergeEvents.stream()
                //load Folders using cloudPipelineApi;
                //client.loadPipelineFolder(id)
                .map(event -> client.loadPipelineFolder(event.getObjectId()))
                //convert Folder to doc
                .map(folder -> convert(folder))
                //save to ES using repo
                .forEach(doc -> folderRepo.save(doc));
    }

    private FolderDoc convert(final Folder folder) {
        return new FolderDoc(folder);
    }
}
