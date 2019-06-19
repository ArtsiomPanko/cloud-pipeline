package com.epam.pipeline.vmmonitor.service.impl;

import com.epam.pipeline.entity.region.CloudProvider;
import com.epam.pipeline.vmmonitor.model.vm.VMTag;
import com.epam.pipeline.vmmonitor.model.vm.VirtualMachine;
import com.epam.pipeline.vmmonitor.service.GCPRegion;
import com.epam.pipeline.vmmonitor.service.VMMonitorService;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.compute.Compute;
import com.google.api.services.compute.ComputeScopes;
import com.google.api.services.compute.model.Instance;
import com.google.api.services.compute.model.InstanceList;
import com.google.api.services.compute.model.NetworkInterface;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.ListUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class GCPMonitorService implements VMMonitorService<GCPRegion> {
    private final HttpTransport httpTransport;
    private final JacksonFactory jsonFactory;
    private final VMTag vmInstanceTag;

    public GCPMonitorService(@Value("${monitor.instance.tag}") final String instanceTagString) {
        try {
            this.httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        } catch (IOException | GeneralSecurityException e) {
            e.printStackTrace();
            throw new RuntimeException(e.getMessage());
        }
        this.jsonFactory = JacksonFactory.getDefaultInstance();
        this.vmInstanceTag = VMTag.fromProperty(instanceTagString);
    }

    @Override
    public CloudProvider provider() {
        return CloudProvider.GCP;
    }

    @Override
    public List<VirtualMachine> fetchRunningVms(final GCPRegion region) {
        final Compute compute = getCompute(region);
        final InstanceList instanceList = getGCPVMInstances(compute, region);
        return getVMListFromVMInstance(instanceList);
    }

    private Compute getCompute(final GCPRegion region) {
        try (InputStream inputStream = new FileInputStream(region.getAuthFile())) {
            final GoogleCredential googleCredential =
                    GoogleCredential.fromStream(inputStream)
                            .createScoped(Collections.singletonList(ComputeScopes.COMPUTE_READONLY));
            return new Compute.Builder(httpTransport, jsonFactory, googleCredential).setApplicationName(region.getApplicationName()).build();
        } catch (IOException e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    private List<VirtualMachine> getVMListFromVMInstance(final InstanceList instanceList) {
        return ListUtils.emptyIfNull(instanceList.getItems())
                .stream()
                .map(this::toVM)
                .collect(Collectors.toList());
    }

    private VirtualMachine toVM(final Instance instance) {
        return VirtualMachine.builder()
                .instanceId(instance.getId().toString())
                .instanceName(instance.getName())
                .privateIp(getPrivateIP(instance))
                .cloudProvider(provider())
                .tags(instance.getLabels())
                .build();
    }

    private String getPrivateIP(final Instance instance) {
        final List<NetworkInterface> networkInterfaces = instance.getNetworkInterfaces();
        return CollectionUtils.isNotEmpty(networkInterfaces) ? networkInterfaces.get(0).getNetworkIP() : null;
    }

    private InstanceList getGCPVMInstances(final Compute compute, final GCPRegion region) {
        try {
            final Compute.Instances.List instances = compute.instances().list(region.getProject(), region.getRegionCode());

            return instances.execute();
        } catch (IOException e) {
            throw new RuntimeException(e.getMessage());
        }
    }
}