package com.epam.pipeline.elasticsearchagent.model;

import org.springframework.data.elasticsearch.annotations.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(indexName = "folder")
public class FolderDoc {
    String id;
    String name;
    String parentId;
    LocalDateTime createdDate;
    Long ownerUserId;
    String ownerUserName;
    String ownerFriendlyName;
    List<String> ownerGroups;
    Map<String, String> metadata;
    List<String> allowed_users;
    List<String> denied_users;
    List<String> allowed_groups;
    List<String> denied_groups;
}
