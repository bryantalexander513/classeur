angular.module('classeur.core.utils', [])
	.factory('clUid', function() {
		var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
		var radix = alphabet.length;
		var length = 20;
		var mapper = Array.apply(null, new Array(length));

		function clUid() {
			var currentDate = Date.now();
			return mapper.map(function() {
				var result =  alphabet[(currentDate + Math.random() * radix) % radix | 0];
				currentDate = Math.floor(currentDate / radix);
				return result;
			}).join('');
		}
		return clUid;
	})
	.factory('clToast', function($mdToast) {
		var hideDelay = 6000;
		var result = function(text, action, cb) {
			var toast = $mdToast.simple()
				.content(text)
				.action(action)
				.position('bottom right')
				.hideDelay(hideDelay);
			$mdToast.show(toast).then(cb || function() {});
		};
		result.hideDelay = hideDelay;
		return result;
	})
	.factory('clPanel', function($window) {
		$window.move.defaults = {
			duration: 0
		};

		function Panel(elt, selector) {
			elt = selector ? angular.element(elt[0].querySelector(selector)) : elt;
			this.$jqElt = elt;
			this.$elt = elt[0];
		}

		Panel.prototype.css = function(attr, value) {
			this.$elt.style[attr] = value !== undefined ? value : '';
			return this;
		};

		function styleSetter(attr, unit) {
			return function(value) {
				this.$elt.style[attr] = value !== undefined ? value + unit : '';
				return this;
			};
		}

		[
			'width',
			'height',
			'top',
			'right',
			'bottom',
			'left',
		].forEach(function(attr) {
			Panel.prototype[attr] = styleSetter(attr, 'px');
		});

		var speedValues = {
			fast: 90,
			slow: 180,
			sslow: 270
		};
		Panel.prototype.move = function(speed) {
			var result = $window.move(this.$elt).ease('out');
			var duration = speedValues[speed];
			duration && result.duration(duration);
			return result;
		};

		return function(elt, selector) {
			return new Panel(elt, selector);
		};
	})
	.factory('clDraggablePanel', function($window, clPanel) {
		var Hammer = $window.Hammer;
		return function(elt, selector, x, y, rotation) {
			rotation = rotation || 0;
			elt.on('mousedown', function(evt) {
				evt.preventDefault();
			});
			var panel = clPanel(elt, selector);
			panel.move().rotate(rotation)
				.then(function() {
					panel.move('slow').rotate(rotation).to(x, y).ease('ease-out-back').end();
				}).end();

			var hammertime = new Hammer(panel.$elt);
			hammertime.get('pan').set({
				direction: Hammer.DIRECTION_ALL,
				threshold: 0
			});
			hammertime.on('panmove', function(evt) {
				evt.preventDefault();
				panel.move().rotate(rotation).to(x + evt.deltaX, y + evt.deltaY).end();
			});
			hammertime.on('panend', function(evt) {
				x += evt.deltaX;
				y += evt.deltaY;
			});
			return panel;
		};
	})
	.factory('clLocalStorageObject', function(clLocalStorage) {

		function defaultParser(val) {
			return val;
		}

		function defaultSerializer(val) {
			return val.toString();
		}

		function simpleObjectSerializer(obj) {
			return JSON.stringify(Object.keys(obj).sort().reduce(function(result, key) {
				return (result[key] = obj[key], result);
			}, {}), function(key, value) {
				return key[0] === '$' ? undefined : value;
			});
		}

		function LocalStorageObject(prefix, attrs, globalUpdate) {
			this.$attrHelpers = Object.keys(attrs).reduce(function($attrHelpers, key) {
				var sKey = '$_' + key;
				var defaultValue = attrs[key].default === undefined ? '' : attrs[key].default;
				var serializer = attrs[key].serializer || defaultSerializer;
				var parser = attrs[key].parser || defaultParser;
				return ($attrHelpers[key] = {
					read: function() {
						var exists = true;
						var lsKey = this.$localPrefix + key;
						var sValue = clLocalStorage.getItem(lsKey);
						if (!sValue) {
							sValue = defaultValue;
							exists = false;
						}
						this[sKey] = sValue;
						this[key] = parser(sValue);
						return exists;
					},
					write: function() {
						var sValue = serializer(this[key]);
						if (sValue !== this[sKey]) {
							this[sKey] = sValue;
							var lsKey = this.$localPrefix + key;
							if (!sValue || sValue === defaultValue) {
								clLocalStorage.removeItem(lsKey);
							} else {
								clLocalStorage.setItem(lsKey, sValue);
							}
							var currentDate = Date.now();
							this.$writeUpdate(currentDate);
							this.$writeGlobalUpdate && this.$writeGlobalUpdate(currentDate);
							return true;
						}
					},
					check: function() {
						var lsKey = this.$localPrefix + key;
						var sValue = clLocalStorage.getItem(lsKey) || defaultValue;
						return sValue !== this[sKey];
					},
					free: function() {
						this[sKey] = undefined;
						this[key] = undefined;
					}
				}, $attrHelpers);
			}, {});

			this.$globalPrefix = prefix ? prefix + '.' : '';
			this.$setId();
			if (globalUpdate) {
				var self = this; // Make sure we update the __proto__ object
				var globalUpdateKey = this.$globalPrefix + 'gu';
				this.$checkGlobalUpdate = function() {
					return self.gUpdated != clLocalStorage[globalUpdateKey];
				};
				this.$readGlobalUpdate = function() {
					self.gUpdated = parseInt(clLocalStorage[globalUpdateKey]);
					isNaN(self.gUpdated) && self.$writeGlobalUpdate(Date.now());
				};
				this.$writeGlobalUpdate = function(updated) {
					self.gUpdated = updated;
					clLocalStorage[globalUpdateKey] = updated;
				};
				this.$readGlobalUpdate();
			}
		}

		LocalStorageObject.prototype.$setId = function(id) {
			this.$localPrefix = this.$globalPrefix + (id ? id + '.' : '');
			this.$updateKey = this.$localPrefix + 'u';
			this.$readUpdate();

			function attrOperation(operation) {
				return function() {
					var result;
					Object.keys(this.$attrHelpers).forEach(function(key) {
						result |= this.$attrHelpers[key][operation].call(this);
					}, this);
					return result;
				};
			}
			this.$read = attrOperation('read');
			this.$write = attrOperation('write');
			this.$check = attrOperation('check');
			this.$free = attrOperation('free');
			Object.keys(this.$attrHelpers).forEach(function(key) {
				this.$read[key] = this.$attrHelpers[key].read.bind(this);
				this.$write[key] = this.$attrHelpers[key].write.bind(this);
				this.$check[key] = this.$attrHelpers[key].check.bind(this);
				this.$free[key] = this.$attrHelpers[key].free.bind(this);
			}, this);
		};

		LocalStorageObject.prototype.$checkUpdate = function() {
			return this.updated != (clLocalStorage[this.$updateKey] || 0);
		};

		LocalStorageObject.prototype.$readUpdate = function() {
			this.updated = parseInt(clLocalStorage[this.$updateKey]);
			if (isNaN(this.updated)) {
				this.updated = 0;
			}
		};

		LocalStorageObject.prototype.$writeUpdate = function(updated) {
			this.updated = updated;
			if (!updated) {
				clLocalStorage.removeItem(this.$updateKey);
			} else {
				clLocalStorage[this.$updateKey] = updated;
			}
		};

		var clLocalStorageObject = function(prefix, attrs, globalUpdate) {
			return new LocalStorageObject(prefix, attrs, globalUpdate);
		};
		clLocalStorageObject.simpleObjectSerializer = simpleObjectSerializer;
		clLocalStorageObject.simpleObjectParser = JSON.parse;
		return clLocalStorageObject;
	})
	.factory('clStateMgr', function($rootScope, $location, clLocalStorage, clUid) {
		var stateKeyPrefix = 'state.';
		var stateMaxAge = 3600000; // 1 hour

		var currentDate = Date.now();
		var keyPrefix = /^state\.(.+)/;
		Object.keys(clLocalStorage).forEach(function(key) {
			var match = key.match(keyPrefix);
			if (match) {
				var stateAge = parseInt(match[1].split('.')[1] || 0);
				(currentDate - stateAge > stateMaxAge) && clLocalStorage.removeItem(key);
			}
		});

		var clStateMgr = {
			saveState: function(state) {
				var stateId = clUid() + '.' + Date.now();
				clLocalStorage[stateKeyPrefix + stateId] = JSON.stringify(state);
				return stateId;
			}
		};

		function checkState(stateId) {
			clStateMgr.state = undefined;
			if (stateId) {
				var storedState = clLocalStorage[stateKeyPrefix + stateId];
				if (storedState) {
					clLocalStorage.removeItem(stateKeyPrefix + stateId);
					clStateMgr.checkedState = JSON.parse(storedState);
					clStateMgr.checkedState.$search = $location.search();
				}
			} else {
				clStateMgr.state = clStateMgr.checkedState;
				clStateMgr.checkedState = undefined;
			}
		}

		$rootScope.$on('$routeChangeStart', function(evt, next) {
			checkState(next.params.stateId);
		});

		return clStateMgr;
	})
	.factory('clSelectionListeningSvc', function($window, $timeout) {
		var clSelectionListeningSvc = {};

		function saveSelection() {
			$timeout(function() {
				var selection = $window.getSelection();
				clSelectionListeningSvc.range = selection.rangeCount && selection.getRangeAt(0);
			}, 25);
		}

		$window.addEventListener('keyup', saveSelection);
		$window.addEventListener('mouseup', saveSelection);
		$window.addEventListener('contextmenu', saveSelection);
		return clSelectionListeningSvc;
	})
	.factory('clSetInterval', function() {
		return function(cb, interval) {
			interval = (1 + (Math.random() - 0.5) * 0.1) * interval | 0;
			setInterval(cb, interval);
		};
	})
	.factory('clUrl', function() {
		return {
			file: function(fileDao, user) {
				var userId = fileDao.userId || (user && user.id) || '';
				if (fileDao.id) {
					return (userId && '/users/' + userId) + '/files/' + fileDao.id;
				} else if (fileDao.fileName) {
					return '/docs/' + fileDao.fileName;
				} else {
					return '';
				}
			},
			docFile: function(fileName) {
				return this.file({
					fileName: fileName
				});
			},
			folder: function(folderDao, user) {
				var userId = folderDao.userId || (user && user.id) || '';
				if (folderDao.id) {
					return (userId && '/users/' + userId) + '/folders/' + folderDao.id;
				} else {
					return '';
				}
			}
		};
	})
	.factory('clUriValidator', function($window) {
		var aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel|file):/,
			imgSrcSanitizationWhitelist = /^\s*(https?|ftp|file):|data:image\//;

		var msie = $window.cledit.Utils.isMsie;

		var urlParsingNode = $window.document.createElement("a");

		function urlResolve(url) {
			var href = url;

			if (msie) {
				// Normalize before parse.  Refer Implementation Notes on why this is
				// done in two steps on IE.
				urlParsingNode.setAttribute("href", href);
				href = urlParsingNode.href;
			}

			urlParsingNode.setAttribute('href', href);

			// urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
			return {
				href: urlParsingNode.href,
				protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
				host: urlParsingNode.host,
				search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
				hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
				hostname: urlParsingNode.hostname,
				port: urlParsingNode.port,
				pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
					urlParsingNode.pathname : '/' + urlParsingNode.pathname
			};
		}

		return function(uri, isImage) {
			var regex = isImage ? imgSrcSanitizationWhitelist : aHrefSanitizationWhitelist;
			var normalizedVal;
			normalizedVal = urlResolve(uri).href;
			if (normalizedVal === '' || normalizedVal.match(regex)) {
				return true;
			}
		};
	})
	.directive('clInfiniteScroll', function($timeout) {
		return {
			restrict: 'A',
			link: function(scope, element, attr) {
				var elt = element[0];

				function trigger() {
					if (elt.scrollTop + elt.offsetHeight > elt.scrollHeight - 300) {
						scope.$eval(attr.clInfiniteScroll) && $timeout(trigger);
					}
				}
				elt.addEventListener('scroll', trigger);
				scope.triggerInfiniteScroll = function() {
					$timeout(trigger);
				};
			}
		};
	})
	.factory('clLocalStorage', function() {
		var version = parseInt(localStorage.getItem('version'));
		if (isNaN(version)) {
			version = 1;
		}
		localStorage.setItem('version', version);
		return localStorage;
	});
