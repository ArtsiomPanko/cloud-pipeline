package com.epam.pipeline.elasticsearchagent.repository;

import com.epam.pipeline.elasticsearchagent.model.FolderDoc;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface FolderRepo extends ElasticsearchRepository<FolderDoc, String> {

}
