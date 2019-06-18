package com.epam.pipeline.vmmonitor;

import com.epam.pipeline.vmmonitor.model.vm.VirtualMachine;
import com.epam.pipeline.vmmonitor.service.GCPRegion;
import com.epam.pipeline.vmmonitor.service.impl.GCPMonitorService;
import org.junit.jupiter.api.Test;

import java.util.List;

public class GCPMonitorTest {

    private static final String CREDENTIALS_PATH = "src\\test\\resources\\credentials.json";
    private static final String PROJECT_NAME = "soy-ascent-242316";
    private static final String REGION_CODE = "europe-north1-a";
    private static final String TAG = "monitored=true";

    @Test
    public void testGCP() {
        GCPRegion gcpRegion = new GCPRegion();

        gcpRegion.setAuthFile(CREDENTIALS_PATH);
        gcpRegion.setProject(PROJECT_NAME);
        gcpRegion.setRegionCode(REGION_CODE);

        GCPMonitorService gcpMonitorService = new GCPMonitorService(TAG);
        List<VirtualMachine> virtualMachineList = gcpMonitorService.fetchRunningVms(gcpRegion);
        System.out.println(virtualMachineList);
    }

}
