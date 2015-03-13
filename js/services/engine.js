manywho.engine = (function (manywho) {

    var waiting = {};

    function processObjectDataRequests(components, flowKey) {

        if (components) {

            var requestComponents = manywho.utils.convertToArray(components).filter(function (component) {

                return component.objectDataRequest != null || component.fileDataRequest != null;

            });

            return $.when.apply($, requestComponents.map(function (component) {

                var limit = manywho.settings.global('paging.' + component.componentType);

                if (component.fileDataRequest) {

                    return manywho.engine.fileDataRequest(component.id, component.fileDataRequest, flowKey, limit);

                }
                else {

                    return manywho.engine.objectDataRequest(component.id, component.objectDataRequest, flowKey, limit);

                }                

            }));

        }

    }

    function isAuthorized(response, flowKey) {

        if (!manywho.authorization.isAuthorized(response, flowKey)) {

            return $.Deferred().reject(response).promise();

        }

        return response;

    }

    function onAuthorizationFailed(response, flowKey, callback) {

        if (manywho.state.getSessionData(flowKey) != null) {

            manywho.authorization.authorizeBySession(response.authorizationContext.loginUrl, flowKey, callback);

        } else {

            // Authorization failed, retry
            manywho.authorization.invokeAuthorization(response, flowKey, callback);

        }

    }

    function loadNavigation(flowKey, stateToken, navigationId) {

        if (navigationId) {

            return manywho.ajax.getNavigation(manywho.utils.extractStateId(flowKey), stateToken, navigationId, manywho.utils.extractTenantId(flowKey))
                    .then(function (navigation) {

                        if (navigation) {

                            manywho.model.parseNavigationResponse(navigationId, navigation, flowKey);

                        }

                    });

        }

        var deferred = new $.Deferred();
        deferred.resolve();
        return deferred;

    }

    function loadExecutionLog(flowKey, authenticationToken) {

        return manywho.ajax.getExecutionLog(manywho.utils.extractTenantId(flowKey), manywho.utils.extractFlowId(flowKey), manywho.utils.extractStateId(flowKey), authenticationToken)
                .then(function (executionLog) {

                    if (executionLog) {

                        manywho.model.setExecutionLog(executionLog);

                    }

                });

    }
    
    function initializeWithAuthorization(callback, tenantId, flowId, flowVersionId, container, options, flowKey) {

        var self = this;
        var authenticationToken = manywho.state.getAuthenticationToken(flowKey);
        var stateId = (flowKey) ? manywho.utils.extractStateId(flowKey) : null;
        var navigationId, streamId = null;

        var initializationRequest = manywho.json.generateInitializationRequest(
            { id: flowId, versionId: flowVersionId },
            stateId,
            options.annotations,
            options.inputs,
            manywho.settings.global('playerUrl'),
            manywho.settings.global('joinUrl'),
            options.mode,
            options.reportingMode
        );

        if (flowKey) {

            manywho.state.setLoading('main', { message: 'Initializing...' }, flowKey);
            self.render(flowKey);

        }

        manywho.ajax.initialize(initializationRequest, tenantId, authenticationToken)
            .then(function (response) {

                flowKey = manywho.utils.getFlowKey(tenantId, flowId, flowVersionId, response.stateId, container);
                streamId = response.currentStreamId;

                if (response.navigationElementReferences && response.navigationElementReferences.length > 0) {

                    navigationId = response.navigationElementReferences[0].id;

                }

                callback.args[5] = flowKey;

                manywho.model.initializeModel(flowKey);
                manywho.settings.initializeFlow(options, flowKey);
                manywho.state.setState(response.stateId, response.stateToken, response.currentMapElementId, flowKey);

                if (options.authentication != null && options.authentication.sessionid != null) {

                    manywho.state.setSessionData(options.authentication.sessionid, options.authentication.sessionurl, flowKey);

                }

                manywho.component.appendFlowContainer(flowKey);
                manywho.state.setLoading('main', { message: 'Initializing...' }, flowKey);
                self.render(flowKey);

                return isAuthorized(response, flowKey);

            })
            .then(function (response) {
                
                var invokeRequest = manywho.json.generateInvokeRequest(
                    manywho.state.getState(flowKey),
                    'FORWARD',
                    null,
                    null,
                    navigationId,
                    manywho.settings.flow('annotations', flowKey),
                    manywho.state.getGeoLocation(),
                    manywho.settings.flow('mode', flowKey)
                );
                
                return manywho.ajax.invoke(invokeRequest, manywho.utils.extractTenantId(flowKey), manywho.state.getAuthenticationToken(flowKey));


            }, function (response) {

                onAuthorizationFailed(response, flowKey, callback);

            })
            .then(function (response) {

                self.parseResponse(response, manywho.model.parseEngineResponse, flowKey);

                manywho.state.setState(response.stateId, response.stateToken, response.currentMapElementId, flowKey);

                manywho.collaboration.initialize(manywho.settings.flow('collaboration.isEnabled', flowKey), flowKey);
                manywho.collaboration.join('user', flowKey);

                var deferreds = [];

                if (navigationId) {

                    deferreds.push(loadNavigation(flowKey, response.stateToken, navigationId));

                }

                if (manywho.settings.isDebugEnabled(flowKey)) {

                    deferreds.push(loadExecutionLog(flowKey, authenticationToken));

                }

                if (streamId) {

                    manywho.social.initialize(flowKey, response.currentStreamId);

                }

                return $.whenAll(deferreds);

            })
            .then(function () {

                if (!getIsWaiting(flowKey)) {

                    manywho.state.setLoading('main', null, flowKey);

                }

                self.render(flowKey);

                processObjectDataRequests(manywho.model.getComponents(flowKey), flowKey);

            });
        
    }
 
    function joinWithAuthorization(callback, flowKey) {

        var self = this;
        var authenticationToken = manywho.state.getAuthenticationToken(flowKey);
        var state = manywho.state.getState(flowKey);
        var isAuthenticated = false;
        
        manywho.state.setLoading('main', { message: 'Joining...' }, flowKey);
        self.render(flowKey);

        manywho.ajax.join(state.id, manywho.utils.extractTenantId(flowKey), authenticationToken)
            .then(function (response) {

                return isAuthorized(response, flowKey);

            })
            .then(function (response) {

                isAuthenticated = true;

                self.parseResponse(response, manywho.model.parseEngineResponse, flowKey);

                manywho.state.setState(response.stateId, response.stateToken, response.currentMapElementId, flowKey);

                manywho.collaboration.initialize(manywho.settings.flow('collaboration.isEnabled', flowKey), flowKey);
                manywho.collaboration.join('user', flowKey);

                var deferreds = [];

                if (response.navigationElementReferences && response.navigationElementReferences.length > 0) {

                    deferreds.push(loadNavigation(flowKey, response.stateToken, response.navigationElementReferences[0].id));

                }

                if (manywho.settings.isDebugEnabled(flowKey)) {

                    deferreds.push(loadExecutionLog(flowKey, authenticationToken));

                }

                if (response.currentStreamId) {
                    
                    manywho.social.initialize(flowKey, response.currentStreamId);

                }

                return $.whenAll(deferreds);

            }, function (response) {

                onAuthorizationFailed(response, flowKey, callback);

            })
            .always(function () {

                if (isAuthenticated) {

                    if (!getIsWaiting(flowKey)) {

                        manywho.state.setLoading('main', null, flowKey);

                    }

                    self.render(flowKey);

                    return processObjectDataRequests(manywho.model.getComponents(flowKey), flowKey);

                }

            });

    }

    function moveWithAuthorization(callback, invokeRequest, flowKey) {

        var self = this;
        var authenticationToken = manywho.state.getAuthenticationToken(flowKey);
        var parentFlowKey = manywho.model.getParentForModal(flowKey) || flowKey;
        var moveResponse = null;

        manywho.ajax.invoke(invokeRequest, manywho.utils.extractTenantId(flowKey), authenticationToken)
            .then(function (response) {

                return isAuthorized(response, flowKey);

            })
            .then(function (response) {

                moveResponse = response;

                self.parseResponse(response, manywho.model.parseEngineResponse, flowKey);
                manywho.state.setState(response.stateId, response.stateToken, response.currentMapElementId, flowKey);

                manywho.collaboration.move(flowKey);
                
                if (manywho.utils.isModal(flowKey) && manywho.utils.isEqual(response.invokeType, 'done', true)) {
                    
                    manywho.model.setModal(parentFlowKey, null);
                                       
                }

                return response;

            }, function (response) {

                manywho.authorization.invokeAuthorization(response, flowKey, callback);

            })
            .then(function (response) {

                var deferreds = [];

                deferreds.push(loadNavigation(flowKey, moveResponse.stateToken, manywho.model.getDefaultNavigationId(flowKey)));

                if (manywho.settings.isDebugEnabled(flowKey)) {

                    deferreds.push(loadExecutionLog(flowKey, authenticationToken));

                }                

                return $.whenAll(deferreds);

            })
            .always(function () {
                
                if (!getIsWaiting(parentFlowKey)) {

                    manywho.state.setLoading('main', null, parentFlowKey);

                }
                
                self.render(parentFlowKey);
                manywho.component.focusInput(parentFlowKey);

                manywho.callbacks.execute(flowKey, moveResponse.invokeType, null, [moveResponse]);
                moveResponse = null;

            })
            .always(function () {

                processObjectDataRequests(manywho.model.getComponents(flowKey), flowKey);

            })

    }
    
    function setIsWaiting(invokeType, flowKey) {

        waiting[flowKey] = manywho.utils.isEqual(invokeType, 'wait', true);

    }

    function getIsWaiting(flowKey) {

        return waiting[flowKey];

    }

    return {

        initialize: function(tenantId, flowId, flowVersionId, container, stateId, authenticationToken, options) {

            options = options || {};

            if (authenticationToken) authenticationToken = decodeURI(authenticationToken);

            if (!tenantId && (!stateId || (!flowId && !flowVersionId))) {

                log.error('tenantId, flowId & flowVersionId must be specified');
                return;

            }

            if (stateId) {

                this.join(tenantId, flowId, flowVersionId, container, stateId, authenticationToken, options);
                
            }
            else {

                initializeWithAuthorization.call(this,
                {
                    execute: initializeWithAuthorization,
                    context: this,
                    args: [tenantId, flowId, flowVersionId, container, options],
                    name: 'initialize',
                    type: 'done'
                },
                tenantId,
                flowId,
                flowVersionId,
                container,
                options);

            }

        },

        move: function(outcome, flowKey) {

            // Validate all of the components on the page here...
            // In the model.js, there are componentInputResponseRequests entries for each component
            // that needs to be validated. If a component does not validate correctly, it should
            // prevent the 'move' and also indicate in the UI which component has failed validation

            if(manywho.utils.isModal(flowKey)) {

                parentFlowKey = manywho.model.getParentForModal(flowKey);
                manywho.state.setLoading('main', { message: 'Executing...' }, parentFlowKey);
                this.render(parentFlowKey);

            } else {

                manywho.state.setLoading('main', { message: 'Executing...' }, flowKey);
                this.render(flowKey);

            }

            var invokeRequest = manywho.json.generateInvokeRequest(
                manywho.state.getState(flowKey),
                'FORWARD',
                outcome.id,
                manywho.state.getPageComponentInputResponseRequests(flowKey),
                manywho.model.getDefaultNavigationId(flowKey),
                manywho.settings.flow('annotations', flowKey),
                manywho.state.getGeoLocation(),
                manywho.settings.flow('mode', flowKey)
            );

            moveWithAuthorization.call(this,
                {
                    execute: moveWithAuthorization,
                    context: this,
                    args: [invokeRequest, flowKey],
                    name: 'invoke',
                    type: 'done'
                },  
                invokeRequest,
                flowKey);
               
        },

        sync: function(flowKey) {

            // Validate all of the components on the page here...
            // In the model.js, there are componentInputResponseRequests entries for each component
            // that needs to be validated. If a component does not validate correctly, it should
            // prevent the 'move' and also indicate in the UI which component has failed validation

            var invokeRequest = manywho.json.generateInvokeRequest(
                manywho.state.getState(flowKey),
                'SYNC',
                null,
                manywho.state.getPageComponentInputResponseRequests(flowKey),
                manywho.settings.flow('annotations', flowKey),
                null,
                manywho.settings.flow('mode', flowKey)
            );
            var self = this;
            
            return manywho.ajax.invoke(invokeRequest, manywho.utils.extractTenantId(flowKey), manywho.state.getAuthenticationToken(flowKey))
                .then(function (response) {

                    self.parseResponse(response, manywho.model.parseEngineSyncResponse, flowKey);
                    return processObjectDataRequests(manywho.model.getComponents(flowKey), flowKey);

                });

        },

        navigate: function(navigationId, navigationElementId, flowKey) {

            manywho.state.setLoading('main', { message: 'Navigating...' }, flowKey);
            this.render(flowKey);

            var invokeRequest = manywho.json.generateNavigateRequest(
                manywho.state.getState(flowKey),
                navigationId,
                navigationElementId,
                manywho.settings.flow('annotations', flowKey),
                null);

            moveWithAuthorization.call(this,
                {
                    execute: moveWithAuthorization,
                    context: this,
                    args: [invokeRequest, flowKey],
                    name: 'invoke',
                    type: 'done'
                },
                invokeRequest,
                flowKey);

        },

        join: function (tenantId, flowId, flowVersionId, container, stateId, authenticationToken, options) {

            var self = this;
            var flowKey = manywho.utils.getFlowKey(tenantId, flowId, flowVersionId, stateId, container);

            if (options.authentication != null && options.authentication.sessionId != null) {

                manywho.state.setSessionData(options.authentication.sessionId, options.authentication.sessionUrl, flowKey);

            }

            manywho.model.initializeModel(flowKey);
            manywho.settings.initializeFlow(options, flowKey);
            
            manywho.state.setAuthenticationToken(authenticationToken, flowKey);
            manywho.state.setState(stateId, null, null, flowKey);

            manywho.component.appendFlowContainer(flowKey);

            joinWithAuthorization.call(this,
                {
                    execute: joinWithAuthorization,
                    context: this,
                    args: [flowKey],
                    name: 'invoke',
                    type: 'done'
                },
                flowKey);
                        
        },

        objectDataRequest: function(id, request, flowKey, limit, search, orderBy, orderByDirection, page) {

            var self = this;

            manywho.state.setLoading(id, { message: 'Loading' }, flowKey);
            self.render(flowKey);

            return manywho.ajax.dispatchObjectDataRequest(request, manywho.utils.extractTenantId(flowKey), manywho.state.getAuthenticationToken(flowKey), limit, search, orderBy, orderByDirection, page)
                .then(function (response) {

                    manywho.state.setLoading(id, null, flowKey);

                    var component = manywho.model.getComponent(id, flowKey);
                    component.objectData = response.objectData;
                    component.objectDataRequest.hasMoreResults = response.hasMoreResults;                    
                    
                })
               .fail(function (xhr, status, error) {

                   manywho.state.setLoading(id, { error: error }, flowKey);

               })
               .always(function () {

                   self.render(flowKey);

               });

        },
        
        fileDataRequest: function (id, request, flowKey, limit, search, orderBy, orderByDirection, page) {

            var self = this;

            manywho.state.setLoading(id, { message: 'Loading' }, flowKey);
            self.render(flowKey);

            return manywho.ajax.dispatchFileDataRequest(request, manywho.utils.extractTenantId(flowKey), manywho.state.getAuthenticationToken(flowKey), limit, search, orderBy, orderByDirection, page)
                .then(function (response) {

                    manywho.state.setLoading(id, null, flowKey);

                    var component = manywho.model.getComponent(id, flowKey);
                    component.objectData = response.objectData;
                    component.fileDataRequest.hasMoreResults = response.hasMoreResults;

                })
               .fail(function (xhr, status, error) {

                   manywho.state.setLoading(id, { error: error }, flowKey);

               })
               .always(function () {

                   self.render(flowKey);

               });

        },


        parseResponse: function(response, responseParser, flowKey) {

            responseParser.call(manywho.model, response, flowKey);

            manywho.state.setState(response.stateId, response.stateToken, response.currentMapElementId, flowKey);
            manywho.state.refreshComponents(manywho.model.getComponents(flowKey), flowKey);

            if (manywho.settings.flow('replaceUrl', flowKey)) {
                manywho.utils.replaceBrowserUrl(response);
            }

            setIsWaiting(response.invokeType, flowKey);
            manywho.engine.ping(flowKey);

        },

        ping: function (flowKey) {

            if (getIsWaiting(flowKey)) {

                var state = manywho.state.getState(flowKey);
                var self = this;

                manywho.ajax.ping(manywho.utils.extractTenantId(flowKey), state.id, state.token, manywho.state.getAuthenticationToken(flowKey))
                    .then(function (response) {

                        if (response)
                        {

                            self.join(state.id);

                        }
                        else {

                            setTimeout(function () { self.ping(flowKey); }, 10000);

                        }

                    });

            }

        },

        render: function (flowKey) {

            if(manywho.utils.isModal(flowKey)) {

                flowKey = manywho.model.getParentForModal(flowKey);

            }

            React.render(React.createElement(manywho.component.getByName('main'), {flowKey: flowKey}), document.getElementById(flowKey));

        }

    }

})(manywho);
