angular.module('classeur.core.button', [])
	.directive('clButton',
		function() {
			return {
				restrict: 'E',
				scope: true,
				transclude: true,
				templateUrl: 'core/button/button.html',
				link: link
			};

			function link(scope, element, attrs) {
				scope.class = attrs.class;
				var opacity = parseFloat(attrs.opacity || 0.7);
				var opacityHover = parseFloat(attrs.opacityHover || 1);
				var opacityActive = parseFloat(attrs.opacityActive || opacityHover);
				var buttonElt = element[0].querySelector('.btn-panel');
				attrs.size && buttonElt.clAnim.width(attrs.size).height(attrs.size);
				['width', 'height', 'top', 'right', 'bottom', 'left'].forEach(function(attrName) {
					var attr = attrs[attrName];
					attr && buttonElt.clAnim[attrName](attr);
				});
				buttonElt.clAnim.start();
				var isActive, isHover, isInited;

				function toggle() {
					buttonElt.classList.toggle('active', !!isActive);
					var opacityToSet = opacity;
					var easing = 'outQuad';
					if (isActive) {
						opacityToSet = opacityActive;
					} else if (isHover) {
						opacityToSet = opacityHover;
					} else {
						opacityToSet = opacity;
						easing = 'inQuad';
					}
					if (isInited) {
						buttonElt.clAnim
							.opacity(opacityToSet)
							.easing(easing)
							.duration(200)
							.start(true);
					} else {
						buttonElt.style.opacity = opacityToSet;
						isInited = true;
					}
				}
				element.on('mouseenter', function() {
					isHover = true;
					toggle();
				});
				element.on('mouseleave', function() {
					isHover = false;
					toggle();
				});
				attrs.active ? scope.$watch(attrs.active, function(value) {
					isActive = value;
					toggle();
				}) : toggle();
			}
		});
