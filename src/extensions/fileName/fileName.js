angular.module('classeur.extensions.fileName', [])
	.directive('clFileName', function() {

		return {
			restrict: 'E',
			templateUrl: 'extensions/fileName/fileName.html',
			link: function(scope) {
				var previousName;
				function setDefaultName() {
					scope.currentFileDao.name = scope.currentFileDao.name || 'Untitled';
					previousName = scope.currentFileDao.name;
				}
				setDefaultName();
				scope.setDefaultName = setDefaultName;
				scope.cancel = function(e) {
					if (e.keyCode == 27) {
						scope.currentFileDao.name = previousName;
					}
				};
			}
		};
	});
