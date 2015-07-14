angular.module('classeur.optional.scrollSync', [])
	.directive('clScrollSyncSettings',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/scrollSync/scrollSyncSettings.html'
			};
		})
	.directive('clScrollSyncEditor',
		function(clScrollSyncSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				clScrollSyncSvc.setEditorElt(element[0]);
				scope.$watch('editorSvc.sectionList', clScrollSyncSvc.onContentChanged);
				scope.$watch('editorSvc.editorSize()', clScrollSyncSvc.onPanelResized);
			}
		})
	.directive('clScrollSyncPreview',
		function(clScrollSyncSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				clScrollSyncSvc.setPreviewElt(element[0]);
				scope.$watch('editorSvc.lastConversion', clScrollSyncSvc.savePreviewHeight);
				scope.$watch('editorSvc.lastPreviewRefreshed', clScrollSyncSvc.restorePreviewHeight);
				scope.$watch('editorSvc.previewSize()', clScrollSyncSvc.onPanelResized);
				scope.$watch('editorLayoutSvc.isPreviewVisible', function(isVisible) {
					isVisible && clScrollSyncSvc.onPreviewOpen();
				});
				scope.$watch('editorSvc.lastSectionMeasured', function() {
					clScrollSyncSvc.updateSectionDescList();
					clScrollSyncSvc.forceScrollSync();
				});
				scope.$watch('localSettingSvc.values.scrollSync', clScrollSyncSvc.forceScrollSync);
			}
		})
	.factory('clScrollSyncSvc',
		function(clEditorLayoutSvc, clEditorSvc, clLocalSettingSvc) {
			var editorElt, previewElt;
			var scrollTimeoutId;
			var currentEndCb, skipAnimation;

			function scroll(elt, startValue, endValue, stepCb, endCb, skipAnimation, debounce) {
				clearTimeout(scrollTimeoutId);
				if (currentEndCb) {
					currentEndCb();
				}
				currentEndCb = endCb;
				var diff = endValue - startValue;
				var startTime = debounce || skipAnimation ? 0 : Date.now();

				function tick() {
					var currentTime = Date.now();
					var progress = (currentTime - startTime) / 100;
					var scrollTop = endValue;
					if (progress < 1) {
						scrollTop = startValue + diff * progress;
						scrollTimeoutId = setTimeout(tick, 10);
					} else {
						scrollTimeoutId = setTimeout(function() {
							currentEndCb();
							currentEndCb = undefined;
						}, 100);
					}
					elt.scrollTop = scrollTop;
					stepCb(scrollTop);
				}

				if (!debounce) {
					return tick();
				}
				stepCb(startValue);
				scrollTimeoutId = setTimeout(tick, 50);
			}

			var lastEditorScrollTop;
			var lastPreviewScrollTop;
			var isScrollEditor;
			var isScrollPreview;
			var isEditorMoving;
			var isPreviewMoving;
			var sectionDescList;

			var doScrollSync = function(debounce) {
				var localSkipAnimation = skipAnimation;
				skipAnimation = false;
				if (!clLocalSettingSvc.values.scrollSync || !sectionDescList || sectionDescList.length === 0) {
					return;
				}
				var editorScrollTop = editorElt.scrollTop;
				editorScrollTop < 0 && (editorScrollTop = 0);
				var previewScrollTop = previewElt.scrollTop;
				var destScrollTop;
				if (isScrollEditor) {

					// Scroll the preview
					isScrollEditor = false;
					lastEditorScrollTop = editorScrollTop;
					editorScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.some(function(sectionDesc) {
						if (editorScrollTop < sectionDesc.editorDimension.endOffset) {
							var posInSection = (editorScrollTop - sectionDesc.editorDimension.startOffset) / (sectionDesc.editorDimension.height || 1);
							destScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					destScrollTop = Math.min(
						destScrollTop,
						previewElt.scrollHeight - previewElt.offsetHeight
					);

					if (Math.abs(destScrollTop - previewScrollTop) <= 9) {
						// Skip the animation if diff is less than 10
						lastPreviewScrollTop = previewScrollTop;
						return;
					}

					scroll(previewElt, previewScrollTop, destScrollTop, function(currentScrollTop) {
						isPreviewMoving = true;
						lastPreviewScrollTop = currentScrollTop;
					}, function() {
						isPreviewMoving = false;
					}, localSkipAnimation, debounce);
				} else if (!clEditorLayoutSvc.isEditorOpen || isScrollPreview) {

					// Scroll the editor
					isScrollPreview = false;
					lastPreviewScrollTop = previewScrollTop;
					previewScrollTop += clEditorSvc.scrollOffset;
					sectionDescList.some(function(sectionDesc) {
						if (previewScrollTop < sectionDesc.previewDimension.endOffset) {
							var posInSection = (previewScrollTop - sectionDesc.previewDimension.startOffset) / (sectionDesc.previewDimension.height || 1);
							destScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection - clEditorSvc.scrollOffset;
							return true;
						}
					});
					destScrollTop = Math.min(
						destScrollTop,
						editorElt.scrollHeight - editorElt.offsetHeight
					);

					if (Math.abs(destScrollTop - editorScrollTop) <= 9) {
						// Skip the animation if diff is less than 10
						lastEditorScrollTop = editorScrollTop;
						return;
					}

					scroll(editorElt, editorScrollTop, destScrollTop, function(currentScrollTop) {
						isEditorMoving = true;
						lastEditorScrollTop = currentScrollTop;
					}, function() {
						isEditorMoving = false;
					}, localSkipAnimation, debounce);
				}
			};

			var oldEditorElt, oldPreviewElt;
			var isPreviewRefreshing;

			function init() {
				if (oldEditorElt === editorElt || oldPreviewElt === previewElt) {
					return;
				}
				oldEditorElt = editorElt;
				oldPreviewElt = previewElt;

				editorElt.addEventListener('scroll', function() {
					if (isEditorMoving) {
						return;
					}
					isScrollEditor = true;
					isScrollPreview = false;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				});

				previewElt.addEventListener('scroll', function() {
					if (isPreviewMoving || isPreviewRefreshing) {
						return;
					}
					isScrollPreview = true;
					isScrollEditor = false;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				});
			}

			var previewHeight, previewContentElt, timeoutId;
			return {
				setEditorElt: function(elt) {
					editorElt = elt;
					init();
				},
				setPreviewElt: function(elt) {
					previewElt = elt;
					previewContentElt = previewElt.children[0];
					init();
				},
				onContentChanged: function() {
					clearTimeout(timeoutId);
					isPreviewRefreshing = true;
					sectionDescList = undefined;
				},
				savePreviewHeight: function() {
					previewHeight = previewContentElt.offsetHeight;
					previewContentElt.style.height = previewHeight + 'px';
				},
				restorePreviewHeight: function() {
					// Now set the correct height
					previewContentElt.style.removeProperty('height');
					isScrollEditor = clEditorLayoutSvc.isEditorOpen;
					// A preview scrolling event can occur if height is smaller
					timeoutId = setTimeout(function() {
						isPreviewRefreshing = false;
					}, 100);
				},
				onPanelResized: function() {
					// This could happen before the editor/preview panels are created
					if (!editorElt) {
						return;
					}
					isScrollEditor = clEditorLayoutSvc.isEditorOpen;
				},
				onPreviewOpen: function() {
					isScrollEditor = true;
					isScrollPreview = false;
					skipAnimation = true;
				},
				updateSectionDescList: function() {
					sectionDescList = clEditorSvc.sectionDescList;
				},
				forceScrollSync: function() {
					if (isPreviewRefreshing) {
						return;
					}
					// Force Scroll Sync
					lastEditorScrollTop = -10;
					lastPreviewScrollTop = -10;
					doScrollSync(!clEditorLayoutSvc.isSidePreviewOpen);
				}
			};
		});
