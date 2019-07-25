package com.epam.pipeline.elasticsearchagent.model;

import com.epam.pipeline.entity.pipeline.Folder;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.elasticsearch.annotations.Document;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Setter
@Getter
@Document(indexName = "folder")
public class FolderDoc {
    private String id;
    private String name;
    private String parentId;
    private LocalDateTime createdDate;
    private Long ownerUserId;
    private String ownerUserName;
    private String ownerFriendlyName;
    private List<String> ownerGroups;
    private Map<String, String> metadata;
    private List<String> allowed_users;
    private List<String> denied_users;
    private List<String> allowed_groups;
    private List<String> denied_groups;

    public FolderDoc(Folder folder) {
        this.id = folder.getId().toString();
        this.name = folder.getName();
        this.parentId = folder.getParentId().toString();
        this.createdDate = convertToLocalDateTimeViaSqlTimestamp(folder.getCreatedDate());
        this.ownerUserName = folder.getOwner();
        this.metadata = convertToStringMapViaStream(folder.getMetadata());
    }

    public LocalDateTime convertToLocalDateTimeViaSqlTimestamp(Date dateToConvert) {
        return new java.sql.Timestamp(dateToConvert.getTime()).toLocalDateTime();
    }

    public Map<String, String> convertToStringMapViaStream(Map<String, Integer> map) {
        return map.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().toString()));
    }
}
