angular.module('DragonDrop', [])
    .directive('dragonDrop', ['$rootScope', '$http', function ($rootScope, $http) {
        var template = "";
        template += "<form class=\"dragondrop\" enctype=\"multipart\/form-data\">";
        template += "    <div class=\"area\">";
        template += "        <div ng-transclude><\/div>";
        template += "    <\/div>";
        template += "    <input type=\"file\" dragon-file name=\"file\" value=\"Choose file\" \/>";
        template += "<\/form>";

        return {
            template: template,
            transclude: true,
            replace: true,
            scope: { id: '&', accepts: '&' },
            link: function (scope, element, attr) {
                var onClass = attr.onClass || 'dragon';
                var busyClass = attr.loadingClass || 'busy';
                var id = scope.id();
                var accepts = scope.accepts();
                var area = angular.element(element.children()[0]);
                var multiple = attr.multiple || false;
                var url = attr.url;
                var manualUrl = attr.manualUrl;
                var method = attr.method || 'POST';
                var isManual;
                var isBusy;
                var files;

                if (angular.isUndefined(id)) throw new Error('DragonDrop: id is required.');
                if (angular.isUndefined(url)) throw new Error('DragonDrop: url is required.');
                if (angular.isUndefined(manualUrl)) throw new Error('DragonDrop: manual-url is required.');

                element.attr('action', manualUrl);
                addBindings(area);
                addListeners();

                /**
                * binds to the dragging events on the target element
                * @param {element} target element
                */
                function addBindings(target) {
                    target.bind('dragover', function (event) {
                        if (isBusy) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                    });

                    target.bind('dragenter', function () {
                        if (isBusy) return;
                        target.addClass(onClass);
                    });

                    target.bind('dragleave', function () {
                        if (isBusy) return;
                        target.removeClass(onClass);
                    });

                    target.bind('drop', function (event) {
                        if (isBusy) return;
                        event.preventDefault();
                        target.removeClass(onClass);
                        handleDrop(event.dataTransfer.files);
                    });
                }

                /**
                * adds the event listeners 
                */
                function addListeners() {
                    scope.$on('dragondrop:upload:' + id, function (event, extradata) {
                        if (isManual) {
                            element[0].submit();
                            busy(true);
                        } else {
                            uploadDropped(extradata);
                        }
                    });

                    scope.$on('dragondrop:manualchange', manualChange);
                }

                /**
                * handles the drop event
                * @param {object} data - the files from the event
                */
                function handleDrop(data) {
                    files = data;
                    var valid = true;
                    if (accepts) {
                        angular.forEach(files, function (file) {
                            if (valid) {
                                valid = accepts.indexOf(file.type) != -1;
                            }
                        });
                    }
                    $rootScope.$broadcast('dragondrop:dropped:' + id, files, valid);
                }

                /**
                * determines the upload type
                * @param {object} extra - extra data to upload
                */
                function uploadDropped(extra) {
                    if (!files || files.length < 1) return;
                    isManual = false;
                    if (multiple)
                        uploadMultiple(extra);
                    else
                        uploadSingle(extra);
                }

                /**
                * uploads the first file with the extra data
                * @param {object} extra - the extra data in an object to post
                */
                function uploadSingle(extra) {
                    busy(true);
                    var reader = new FileReader();
                    reader.onload = function (event) {

                        var data = { file: event.target.result };
                        if (extra) {
                            data = extra;
                            data.file = event.target.result;
                        }

                        $http({ method: method, url: url, data: data })
                            .success(function (response) {
                                $rootScope.$broadcast('dragondrop:success:' + id, response);
                            })
                            .error(function (response) {
                                $rootScope.$broadcast('dragondrop:error:' + id, response);
                            })
                            ['finally'](function () {
                                busy(false);
                            });
                    };
                    reader.readAsDataURL(files[0]);
                }

                /**
                * sets the busy state and class
                */
                function busy(on) {
                    scope.isBusy = on;
                    if (isBusy) element.addClass(busyClass);
                    else element.removeClass(busyClass);

                    $rootScope.$broadcast('dragondrop:busy:' + id, on);
                    setManualDisplay(on);
                }

                /*
                * sets the display of the manual upload button.
                */
                function setManualDisplay(on) {
                    debugger;
                    var manual = angular.element(element.children()[1]);
                    if (on)
                        manual[0].style.display = 'none';
                    else {
                        manual[0].style.display = 'block';
                    }
                }

                /**
                * Sets the manual flag and broadcasts the ready for manual thing
                */
                function manualChange(value) {
                    if (!value) return;
                    isManual = true;
                    $rootScope.$broadcast('dragondrop:manual:' + id);
                }
            }
        };
    }])
    .directive('dragonFile', function () {
        return function (scope, element, attr) {
            element.bind('change', function () {
                scope.$broadcast('dragondrop:manualchange');
            });
        };
    })
    .factory('$dragondrop', ['$rootScope', '$q', function ($rootScope, $q) {
        return function (id) {
            var self = this;
            self.id = id;


            /**
          * calls the upload via broadcasting an event 
          * @param {object} extra - the extra data to upload
          * @param {object} scope - use the passed scope instead of $rootScope
          * @returns {promise} promise
          */
            self.upload = function (extra, scope) {
                scope = scope || $rootScope;
                var deferred = $q.defer();

                scope.$on('dragondrop:success:' + id, function (event, response) {
                    deferred.resolve(response);
                });

                scope.$on('dragondrop:error:' + id, function () {
                    deferred.reject();
                });

                scope.$broadcast('dragondrop:upload:' + id, extra);

                return deferred.promise;
            };

            /**
          * listens the drop event for a specific  id
          * @param {function} cb - the function to call on event
          * @param {object} scope - the scope to use instead of $rootScope
          */
            self.listenToDrop = function (cb, scope) {
                scope = scope || $rootScope;
                scope.$on('dragondrop:dropped:' + id, cb);
            };

            /**
          * listens the manual event for a specific  id
          * @param {function} cb - the function to call on event
          * @param {object} scope - the scope to use instead of $rootScope
          */
            self.listenToManual = function (cb, scope) {
                scope = scope || $rootScope;
                scope.$on('dragondrop:manual:' + id, cb);
            };

            return self;
        };
    }]);