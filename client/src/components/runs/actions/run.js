/*
 * Copyright 2017-2019 EPAM Systems, Inc. (https://www.epam.com/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import {inject, observer, Provider} from 'mobx-react';
import {computed, observable} from 'mobx';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  Icon,
  message,
  Modal,
  Row,
  Select,
  Tooltip
} from 'antd';
import PipelineRunner from '../../../models/pipelines/PipelineRunner';
import PipelineRunEstimatedPrice from '../../../models/pipelines/PipelineRunEstimatedPrice';
import {names} from '../../../models/utils/ContextualPreference';
import {autoScaledClusterEnabled} from '../../pipelines/launch/form/utilities/launch-cluster';
import {LIMIT_MOUNTS_PARAMETER} from '../../pipelines/launch/form/LimitMountsInput';
import '../../../staticStyles/tooltip-nowrap.css';
import AWSRegionTag from '../../special/AWSRegionTag';
import awsRegions from '../../../models/cloudRegions/CloudRegions';

// Mark class with @submitsRun if it may launch pipelines / tools
export const submitsRun = (...opts) => inject('instanceTypes')(...opts);

export function run (parent, callback) {
  if (!parent) {
    console.warn('"run" function should be called with parent component passed to arguments:');
    console.warn('"run(parent)"');
    console.warn('Parent component should be marked with @runPipelineActions');
    throw new Error('"run" function should be called with parent component passed to arguments:');
  }
  return function (payload, confirm = true, title, warning, allowedInstanceTypesRequest) {
    return runFn(payload, confirm, title, warning, parent.props, callback, allowedInstanceTypesRequest);
  };
}

export function modifyPayloadForAllowedInstanceTypes (payload, allowedInstanceTypesRequest) {
  if (allowedInstanceTypesRequest && allowedInstanceTypesRequest.loaded) {
    let availableInstanceTypes = [];
    if (payload.dockerImage) {
      availableInstanceTypes = (allowedInstanceTypesRequest.value[names.allowedToolInstanceTypes] || [])
        .map(i => i.name);
    } else {
      availableInstanceTypes = (allowedInstanceTypesRequest.value[names.allowedInstanceTypes] || [])
        .map(i => i.name);
    }
    const availablePriceTypes = (allowedInstanceTypesRequest.value[names.allowedPriceTypes] || []).map(p => {
      if (p === 'spot') {
        return true;
      } else if (p === 'on_demand') {
        return false;
      }
      return undefined;
    }).filter(p => p !== undefined);
    const getAvailableValue = (value, values, chooseDefault = true) => {
      const [v] = values.filter(v => v === value);
      if (v !== undefined) {
        return v;
      } else if (values.length > 0 && chooseDefault) {
        return values[0];
      }
      return null;
    };
    payload.instanceType = getAvailableValue(payload.instanceType, availableInstanceTypes, false);
    payload.isSpot = getAvailableValue(`${payload.isSpot}` === 'true', availablePriceTypes);
    return payload;
  }
  return payload;
}

function runFn (payload, confirm, title, warning, stores, callbackFn, allowedInstanceTypesRequest) {
  return new Promise(async (resolve) => {
    let launchName;
    let availableInstanceTypes = [];
    let availablePriceTypes = [true, false];
    allowedInstanceTypesRequest && await allowedInstanceTypesRequest.fetchIfNeededOrWait();
    if (allowedInstanceTypesRequest && allowedInstanceTypesRequest.loaded) {
      if (payload.dockerImage) {
        availableInstanceTypes = (allowedInstanceTypesRequest.value[names.allowedToolInstanceTypes] || [])
          .map(i => i);
      } else {
        availableInstanceTypes = (allowedInstanceTypesRequest.value[names.allowedInstanceTypes] || [])
          .map(i => i);
      }
      availablePriceTypes = (allowedInstanceTypesRequest.value[names.allowedPriceTypes] || []).map(p => {
        if (p === 'spot') {
          return true;
        } else if (p === 'on_demand') {
          return false;
        }
        return undefined;
      }).filter(p => p !== undefined);
    } else if (stores && stores.instanceTypes) {
      await stores.instanceTypes.fetchIfNeededOrWait();
      if (stores.instanceTypes.loaded) {
        availableInstanceTypes = (stores.instanceTypes.value || []).map(i => i);
      }
    }
    if (payload.pipelineId) {
      const {pipelines} = stores;
      await pipelines.fetchIfNeededOrWait();
      const [pipeline] = (pipelines.value || []).filter(p => `${p.id}` === `${payload.pipelineId}`);
      if (pipeline) {
        launchName = pipeline.name;
      }
    } else {
      const [, , imageName] = payload.dockerImage.split('/');
      const parts = imageName.split(':');
      if (parts.length === 2) {
        launchName = `${parts[0]} (version ${parts[1]})`;
      } else {
        launchName = imageName;
      }
    }
    const launchFn = async () => {
      const hide = message.loading(`Launching ${launchName}...`, -1);
      await PipelineRunner.send({...payload, force: true});
      hide();
      if (PipelineRunner.error) {
        message.error(PipelineRunner.error);
        resolve(false);
        callbackFn && callbackFn(false);
      } else {
        resolve(true);
        callbackFn && callbackFn(true);
      }
    };
    if (!confirm) {
      await launchFn();
    } else {
      const {dataStorageAvailable} = stores;
      let dataStorages;
      if (dataStorageAvailable) {
        await dataStorageAvailable.fetchIfNeededOrWait();
        if (dataStorageAvailable.loaded) {
          dataStorages = (dataStorageAvailable.value || []).map(d => d);
        }
      }
      let component;
      const ref = (element) => {
        component = element;
      };
      Modal.confirm({
        title: title || `Launch ${launchName}?`,
        width: '50%',
        content: (
          <RunSpotConfirmationWithPrice
            ref={ref}
            warning={warning}
            instanceType={payload.instanceType}
            hddSize={payload.hddSize}
            isSpot={payload.isSpot}
            isCluster={payload.nodeCount > 0 || autoScaledClusterEnabled(payload.params)}
            onDemandSelectionAvailable={availablePriceTypes.indexOf(false) >= 0}
            pipelineId={payload.pipelineId}
            pipelineVersion={payload.version}
            pipelineConfiguration={payload.configurationName}
            nodeCount={(+payload.nodeCount) || 0}
            cloudRegionId={payload.cloudRegionId}
            availableInstanceTypes={availableInstanceTypes}
            dataStorages={dataStorages}
            limitMounts={
              payload.params && payload.params[LIMIT_MOUNTS_PARAMETER]
                ? payload.params[LIMIT_MOUNTS_PARAMETER].value
                : undefined
            } />
        ),
        style: {
          wordWrap: 'break-word'
        },
        okText: 'Launch',
        onOk: async function () {
          if (component) {
            payload.isSpot = component.state.isSpot;
            payload.instanceType = component.state.instanceType;
            if (component.state.limitMounts !== component.props.limitMounts) {
              const {limitMounts} = component.state;
              if (limitMounts) {
                if (!payload.params) {
                  payload.params = {};
                }
                payload.params[LIMIT_MOUNTS_PARAMETER] = {
                  type: 'string',
                  required: false,
                  value: limitMounts
                };
              } else if (payload.params && payload.params[LIMIT_MOUNTS_PARAMETER]) {
                delete payload.params[LIMIT_MOUNTS_PARAMETER];
              }
            }
          }
          if (!payload.instanceType) {
            message.error('You should select instance type');
            resolve(false);
            callbackFn && callbackFn(false);
          } else {
            const hide = message.loading(`Launching ${launchName}...`, -1);
            await PipelineRunner.send({...payload, force: true});
            hide();
            if (PipelineRunner.error) {
              message.error(PipelineRunner.error);
              resolve(false);
              callbackFn && callbackFn(false);
            } else {
              resolve(true);
              callbackFn && callbackFn(true);
            }
          }
        },
        onCancel () {
          resolve(false);
          callbackFn && callbackFn(false);
        }
      });
    }
  });
}

function isUniqueInArray(element, index, array) {
  return array.filter(e => e === element).length === 1;
}

function notUniqueInArray(element, index, array) {
  return array.filter(e => e === element).length > 1;
}

@observer
export class RunConfirmation extends React.Component {

  state = {
    isSpot: false,
    instanceType: null,
    limitMounts: null
  };

  static propTypes = {
    warning: PropTypes.string,
    isSpot: PropTypes.bool,
    isCluster: PropTypes.bool,
    onDemandSelectionAvailable: PropTypes.bool,
    onChangePriceType: PropTypes.func,
    instanceType: PropTypes.string,
    instanceTypes: PropTypes.array,
    showInstanceTypeSelection: PropTypes.bool,
    onChangeInstanceType: PropTypes.func,
    dataStorages: PropTypes.array,
    limitMounts: PropTypes.string,
    onChangeLimitMounts: PropTypes.func
  };

  static defaultProps = {
    onDemandSelectionAvailable: true
  };

  @computed
  get gpuEnabled () {
    const [currentInstanceType] = (this.props.instanceTypes || []).filter(i => i.name === this.state.instanceType);
    return currentInstanceType && currentInstanceType.hasOwnProperty('gpu') && +currentInstanceType.gpu > 0;
  }

  @computed
  get initialSelectedDataStorageIndecis() {
    return (this.props.limitMounts || this.dataStorages.map(d => `${d.id}`).join(','))
      .split(',')
      .map(d => +d);
  }

  @computed
  get selectedDataStorageIndecis() {
    return (this.state.limitMounts || this.dataStorages.map(d => `${d.id}`).join(','))
      .split(',')
      .map(d => +d);
  }

  @computed
  get dataStorages() {
    return (this.props.dataStorages || []).map(d => d);
  }

  @computed
  get initialSelectedDataStorages() {
    return this.dataStorages.filter(d => this.initialSelectedDataStorageIndecis.indexOf(+d.id) >= 0);
  }

  @computed
  get conflicting() {
    return this.initialSelectedDataStorages
      .filter((d, i, a) =>
        !!d.mountPoint &&
        notUniqueInArray(d.mountPoint, i, a.map(aa => aa.mountPoint))
      );
  }

  @computed
  get notConflictingIndecis() {
    return this.initialSelectedDataStorages
      .filter((d, i, a) =>
        !d.mountPoint ||
        isUniqueInArray(d.mountPoint, i, a.map(aa => aa.mountPoint))
      )
      .map(d => +d.id);
  }

  @computed
  get initialLimitMountsHaveConflicts() {
    return this.dataStorages
      .filter(d => this.initialSelectedDataStorageIndecis.indexOf(+d.id) >= 0 && !!d.mountPoint)
      .map(d => d.mountPoint)
      .filter(notUniqueInArray)
      .length > 0;
  }

  @computed
  get limitMountsHaveConflicts() {
    return this.dataStorages
      .filter(d => this.selectedDataStorageIndecis.indexOf(+d.id) >= 0 && !!d.mountPoint)
      .map(d => d.mountPoint)
      .filter(notUniqueInArray)
      .length > 0;
  }

  getInstanceTypes = () => {
    if (!this.props.instanceTypes) {
      return [];
    }
    const instanceTypes = [];
    for (let i = 0; i < this.props.instanceTypes.length; i++) {
      const instanceType = this.props.instanceTypes[i];
      if (instanceTypes.filter(t => t.name === instanceType.name).length === 0) {
        instanceTypes.push(instanceType);
      }
    }
    return instanceTypes.sort((typeA, typeB) => {
      const vcpuCompared = typeA.vcpu - typeB.vcpu;
      const skuCompare = (a, b) => {
        return a.instanceFamily > b.instanceFamily
          ? 1
          : a.instanceFamily < b.instanceFamily ? -1 : 0;
      };
      return vcpuCompared === 0 ? skuCompare(typeA, typeB) : vcpuCompared;
    });
  };

  setOnDemand = (onDemand) => {
    this.setState({
      isSpot: !onDemand
    }, () => {
      this.props.onChangePriceType && this.props.onChangePriceType(this.state.isSpot);
    });
  };

  setInstanceType = (instanceType) => {
    this.setState({
      instanceType
    }, () => {
      this.props.onChangeInstanceType && this.props.onChangeInstanceType(this.state.instanceType);
    });
  };

  getSelectStructure = () => {
    const groups = [];
    for (let i = 0; i < this.conflicting.length; i++) {
      const dataStorage = this.conflicting[i];
      if (dataStorage.mountPoint) {
        let [group] = groups.filter(g => g.key === dataStorage.mountPoint);
        if (!group) {
          group = {
            key: dataStorage.mountPoint,
            storages: []
          };
          groups.push(group);
        }
        group.storages.push(dataStorage);
      }
    }
    return groups.map(g => (
      <Select.OptGroup key={g.key} label={g.key}>
        {
          g.storages.map(s => (
            <Select.Option key={s.id} value={s.id.toString()} name={s.name} pathMask={s.pathMask}>
              <Tooltip
                overlayClassName="limit-mounts-warning"
                title={s.pathMask}>
                <div style={{height: 30, display: 'flex', flexDirection: 'column', position: 'relative'}}>
                  <b style={{height: 20, lineHeight: '20px'}}>
                    <AWSRegionTag regionId={s.regionId} regionUID={s.regionName} /> {s.name}
                  </b>
                  <span style={{position: 'absolute', height: 12, lineHeight: '12px', top: 20, left: 5}}>
                    {s.pathMask}
                  </span>
                </div>
              </Tooltip>
            </Select.Option>
          ))
        }
      </Select.OptGroup>
    ));
  };

  onSelect = (selectedConflictingIds) => {
    const selectedIds = [...this.notConflictingIndecis, ...selectedConflictingIds];
    if (selectedIds.length > 0) {
      this.setState({
        limitMounts: selectedIds.length === this.dataStorages.length ? undefined : selectedIds.join(',')
      }, () => {
        this.props.onChangeLimitMounts && this.props.onChangeLimitMounts(this.state.limitMounts);
      });
    }
  };

  renderLimitMountsSelector = () => {
    return (
      <Provider awsRegions={awsRegions}>
        <Select
          style={{width: '100%'}}
          mode="multiple"
          onChange={this.onSelect}
          notFoundContent="Mounts not found"
          filterOption={
            (input, option) =>
              option.props.name.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
              option.props.pathMask.toLowerCase().indexOf(input.toLowerCase()) >= 0}
          value={
            this.selectedDataStorageIndecis
              .filter(i => this.notConflictingIndecis.indexOf(+i) === -1)
              .map(i => i.toString())
          }
        >
          {this.getSelectStructure()}
        </Select>
      </Provider>
    );
  };

  render () {
    return (
      <div>
        {
          this.props.warning &&
          <Alert
            style={{margin: 2}}
            key="warning"
            type="warning"
            showIcon
            message={this.props.warning} />
        }
        {
          this.props.onDemandSelectionAvailable && this.props.isSpot && this.state.isSpot &&
          <Alert
            style={{margin: 2}}
            key="spot warning"
            type="info"
            showIcon
            message={
              <div>
                <Row style={{marginBottom: 5}}>
                  <b>You are going to launch a job using a SPOT instance.</b>
                </Row>
                <Row style={{marginBottom: 5}}>
                  <b>While this is much cheaper, this type of instance may be OCCASINALLY STOPPED, without a notification and you will NOT be able to PAUSE this run, only STOP.
                  Consider SPOT instance for batch jobs and short living runs.</b>
                </Row>
                <Row style={{marginBottom: 5}}>
                  To change this setting use <b>ADVANCED -> PRICE TYPE</b> option within a launch form.
                </Row>
                <Row type="flex" justify="center" style={{marginBottom: 5}}>
                  <Button
                    onClick={() => this.setOnDemand(true)}
                    type="primary"
                    size="small">Set ON-DEMAND price type</Button>
                </Row>
              </div>
            } />
        }
        {
          this.props.isSpot && !this.state.isSpot &&
          <Alert
            style={{margin: 2}}
            key="spot warning"
            type="info"
            showIcon
            message={
              <div>
                <Row style={{marginBottom: 5}}>
                  <b>You are going to launch a job using a ON-DEMAND instance.</b>
                </Row>
                <Row style={{marginBottom: 5}}>
                  You will be able to PAUSE this run.
                </Row>
                <Row type="flex" justify="center" style={{marginBottom: 5}}>
                  <Button
                    onClick={() => this.setOnDemand(false)}
                    size="small">Set SPOT price type</Button>
                </Row>
              </div>
            } />
        }
        {
          this.props.isCluster && !this.state.isSpot &&
          <Alert
            type="info"
            style={{margin: 2}}
            showIcon
            message={
              <Row>
                Note that clusters cannot be paused, even if on-demand price is selected
              </Row>
            } />
        }
        {
          this.props.isCluster &&
          <Alert
            type="info"
            style={{margin: 2}}
            showIcon
            message={
              <Row>
                Note that you will not be able to commit a cluster. Commit feature is only available for single-node runs
              </Row>
            } />
        }
        {
          !this.props.isCluster && this.gpuEnabled &&
          <Alert
            type="info"
            style={{margin: 2}}
            showIcon
            message={
              <Row>
                <Row style={{marginBottom: 5}}>
                  <b>You are going to launch a job using GPU-enabled instance</b> - <b>{this.state.instanceType}.</b>
                </Row>
                <Row style={{marginBottom: 5}}>
                  Note that if you install any <b>NVIDIA packages</b> manually and commit it, that may produce an unusable image.
                </Row>
                <Row>
                  All cuda-based dockers shall be built using <b><a target="_blank" href="https://hub.docker.com/r/nvidia/cuda/">nvidia/cuda</a></b> base image instead.
                </Row>
              </Row>
            } />
        }
        {
          this.props.showInstanceTypeSelection && this.getInstanceTypes().length > 0 &&
          <Alert
            style={{margin: 2}}
            key="instance type warning"
            type="info"
            showIcon
            message={
              <div>
                <Row>
                  <b>You should select instance type:</b>
                </Row>
                <Select
                  value={this.state.instanceType}
                  style={{width: '100%'}}
                  showSearch
                  allowClear={false}
                  placeholder="Instance type"
                  optionFilterProp="children"
                  notFoundContent="Instance types not found"
                  onChange={this.setInstanceType}
                  filterOption={
                    (input, option) =>
                    option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                  {
                    this.getInstanceTypes()
                      .map(t => t.instanceFamily)
                      .filter((familyName, index, array) => array.indexOf(familyName) === index)
                      .map(instanceFamily => {
                        return (
                          <Select.OptGroup key={instanceFamily || 'Other'} label={instanceFamily || 'Other'}>
                            {
                              this.getInstanceTypes()
                                .filter(t => t.instanceFamily === instanceFamily)
                                .map(t =>
                                  <Select.Option
                                    key={t.sku}
                                    value={t.name}>
                                    {t.name} (CPU: {t.vcpu}, RAM: {t.memory}{t.gpu ? `, GPU: ${t.gpu}`: ''})
                                  </Select.Option>
                                )
                            }
                          </Select.OptGroup>
                        );
                      })
                  }
                </Select>
              </div>
            } />
        }
        {
          this.props.showInstanceTypeSelection && this.getInstanceTypes().length === 0 &&
          <Alert
            style={{margin: 2}}
            key="instance type missing warning"
            type="warning"
            showIcon
            message={
              <div>
                <Row>
                  <b>You have no instance types available.</b>
                </Row>
              </div>
            } />
        }
        {
          this.initialLimitMountsHaveConflicts && (
            <Alert
              style={{margin: 2}}
              type={this.limitMountsHaveConflicts ? 'warning' : 'success'}
              showIcon
              message={
                <div>
                  <Row style={{marginBottom: 5}}>
                    There is a number of data storages, that are going to be mounted to the same location within the compute node. This may lead to unexpected behavior.
                  </Row>
                  <Row style={{marginBottom: 5, fontWeight: 'bold'}}>
                    Please review the list of the mount points below and choose the data storage to be mounted:
                  </Row>
                  <Row style={{width: '100%'}}>
                    {this.renderLimitMountsSelector()}
                  </Row>
                </div>
              }
            />
          )
        }
      </div>
    );
  }

  componentDidMount () {
    this.updateState(this.props);
  }

  updateState = (props) => {
    this.setState({
      isSpot: props.isSpot,
      instanceType: props.instanceType,
      limitMounts: props.limitMounts
    });
  };
}

@observer
export class RunSpotConfirmationWithPrice extends React.Component {
  static propTypes = {
    warning: PropTypes.string,
    isSpot: PropTypes.bool,
    isCluster: PropTypes.bool,
    onDemandSelectionAvailable: PropTypes.bool,
    onChangePriceType: PropTypes.func,
    pipelineId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pipelineVersion: PropTypes.string,
    pipelineConfiguration: PropTypes.string,
    instanceType: PropTypes.string,
    availableInstanceTypes: PropTypes.array,
    hddSize: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nodeCount: PropTypes.number,
    cloudRegionId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    dataStorages: PropTypes.array,
    limitMounts: PropTypes.string,
    onChangeLimitMounts: PropTypes.func
  };

  static defaultProps = {
    onDemandSelectionAvailable: true
  };

  @observable _estimatedPriceType = null;

  state = {
    isSpot: false,
    instanceType: null,
    limitMounts: null
  };

  onChangeSpotType = (isSpot) => {
    this.setState({
      isSpot
    }, async () => {
      await this._estimatedPriceType.send({
        instanceType: this.state.instanceType,
        instanceDisk: this.props.hddSize,
        spot: this.state.isSpot,
        regionId: this.props.cloudRegionId
      });
    });
  };

  onChangeInstanceType = (instanceType) => {
    this.setState({
      instanceType
    }, async () => {
      await this._estimatedPriceType.send({
        instanceType: this.state.instanceType,
        instanceDisk: this.props.hddSize,
        spot: this.state.isSpot,
        regionId: this.props.cloudRegionId
      });
    });
  };

  onChangeLimitMounts = (limitMounts) => {
    this.setState({
      limitMounts
    }, async () => {
      this.props.onChangeLimitMounts && this.props.onChangeLimitMounts(limitMounts);
    });
  };

  render () {
    return (
      <div>
        <Row>
          <RunConfirmation
            warning={this.props.warning}
            onChangePriceType={this.onChangeSpotType}
            isSpot={this.props.isSpot}
            isCluster={this.props.isCluster}
            onDemandSelectionAvailable={this.props.onDemandSelectionAvailable}
            showInstanceTypeSelection={!this.props.instanceType}
            onChangeInstanceType={this.onChangeInstanceType}
            instanceType={this.props.instanceType}
            instanceTypes={this.props.availableInstanceTypes}
            dataStorages={this.props.dataStorages}
            limitMounts={this.props.limitMounts}
            onChangeLimitMounts={this.onChangeLimitMounts} />
        </Row>
        {
          this._estimatedPriceType &&
          this._estimatedPriceType.loaded &&
          this._estimatedPriceType.value.pricePerHour &&
          <Alert
            type="success"
            style={{margin: 2}}
            message={
              this._estimatedPriceType.pending
                ? <Row>Estimated price: <Icon type="loading" /></Row>
                : <Row>Estimated price: <b>{
                (Math.ceil(this._estimatedPriceType.value.pricePerHour * 100.0) / 100.0 * (this.props.nodeCount + 1))
                  .toFixed(2)
                }$</b> per hour.</Row>
            } />
        }
      </div>
    );
  }

  componentDidMount () {
    this.setState({
      isSpot: this.props.isSpot,
      instanceType: this.props.instanceType,
      limitMounts: this.props.limitMounts
    }, async () => {
      this._estimatedPriceType = new PipelineRunEstimatedPrice(
        this.props.pipelineId,
        this.props.pipelineVersion,
        this.props.pipelineConfiguration
      );
      await this._estimatedPriceType.send({
        instanceType: this.state.instanceType,
        instanceDisk: this.props.hddSize,
        spot: this.state.isSpot,
        regionId: this.props.cloudRegionId
      });
    });
  }
}
