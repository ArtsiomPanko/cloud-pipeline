package com.epam.pipeline.elasticsearchagent.app;

import org.elasticsearch.client.Client;
import org.elasticsearch.client.transport.TransportClient;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.common.transport.InetSocketTransportAddress;
import org.elasticsearch.transport.client.PreBuiltTransportClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

import java.net.InetAddress;
import java.net.UnknownHostException;

@EnableElasticsearchRepositories("com.epam.pipeline.elasticsearchagent.repository")
@Configuration
public class FolderConfiguration {
    @Value("${applications.properties:elasticsearch.client.url}")
    private String elasticsearchUrl;

    @Value("${applications.properties:elasticsearch.client.port}")
    private String elasticsearchPort;

    @Bean
    public Client client() throws UnknownHostException {
        Settings elasticsearchSettings = Settings.builder()
                .put("cluster.name", "elasticsearch")
                .build();
        TransportClient client = new PreBuiltTransportClient(elasticsearchSettings);
        client.addTransportAddress(new InetSocketTransportAddress(InetAddress.getByName(elasticsearchUrl), Integer.parseInt(elasticsearchPort)));
        return client;
    }

    @Bean
    public ElasticsearchOperations elasticsearchTemplate() throws UnknownHostException {
        return new ElasticsearchTemplate(client());
    }
}
