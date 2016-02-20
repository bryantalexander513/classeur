angular.module('classeur.optional.fileHistory', [])
  .directive('clFileHistoryTab',
    function (clFileHistorySvc, clContentSyncSvc, clDiffUtils, clDialog, clEditorSvc) {
      return {
        restrict: 'E',
        scope: true,
        templateUrl: 'optional/fileHistory/fileHistoryTab.html',
        link: link
      }

      function link (scope) {
        scope.fileHistorySvc = clFileHistorySvc
        clFileHistorySvc.init()

        scope.selectChangeGroup = function (changeGroup) {
          if (clFileHistorySvc.selectedChangeGroup !== changeGroup) {
            clFileHistorySvc.selectedChangeGroup = changeGroup
          } else {
            clFileHistorySvc.selectedChangeGroup = undefined
          }
        }

        scope.restoreRevision = function (revision) {
          var file = scope.currentFile
          var confirm = clDialog.confirm()
            .title('Restore revision')
            .textContent('Are you sure you want to restore the selected revision?')
            .ariaLabel('Restore revision')
            .ok('Yes')
            .cancel('No')
          clDialog.show(confirm).then(function () {
            clContentSyncSvc.retrieveRevision(revision)
              .then(function (result) {
                if (file !== scope.currentFile || file.state !== 'loaded') {
                  return
                }
                clEditorSvc.setContent(result.text)
              })
          })
        }

        clFileHistorySvc.selectedChangeGroup = undefined
        scope.$watchGroup(['fileHistorySvc.selectedChangeGroup', 'fileHistorySvc.changeGroups'], function () {
          scope.isLoading = true
          var changeGroup = clFileHistorySvc.selectedChangeGroup
          if (changeGroup) {
            if (clFileHistorySvc.changeGroups.indexOf(changeGroup) === -1) {
              clFileHistorySvc.selectedChangeGroup = undefined
            } else {
              clContentSyncSvc.retrieveRevision(changeGroup.fromRev)
                .then(function (result1) {
                  return clContentSyncSvc.retrieveRevision(changeGroup.toRev)
                    .then(function (result2) {
                      if (changeGroup === clFileHistorySvc.selectedChangeGroup) {
                        scope.isLoading = false
                        scope.textChanges = clDiffUtils.getTextPatches(result1.text, result2.text)
                        scope.commentChanges = clDiffUtils.getObjectPatches(result1.comments, result2.comments)
                        scope.noChange = !scope.textChanges
                        if (scope.commentChanges) {
                          scope.commentChanges = scope.commentChanges.cl_filter(function (commentChange) {
                            return commentChange.a
                          })
                          scope.noChange &= !scope.commentChanges.length
                        }
                      }
                    })
                })
            }
          }
        })
      }
    })
  .directive('clFileHistoryEntry',
    function () {
      return {
        restrict: 'E',
        templateUrl: 'optional/fileHistory/fileHistoryEntry.html',
        link: link
      }

      function link (scope) {
      }
    })
  .factory('clFileHistorySvc',
    function (clSocketSvc) {
      var pageSize = 20
      var clFileHistorySvc = {}

      var changeGroups = []
      clSocketSvc.addMsgHandler('watchedFile', function (msg) {
        if (msg.content) {
          changeGroups = msg.content.changeGroups.slice().sort(function (group1, group2) {
            return group2.toRev - group1.toRev
          })
          refreshChangeGroups()
        }
      })

      function refreshChangeGroups () {
        clFileHistorySvc.changeGroups = changeGroups.slice(0, clFileHistorySvc.maxShow)
        clFileHistorySvc.hasMore = clFileHistorySvc.maxShow < changeGroups.length
      }

      clFileHistorySvc.init = function () {
        clFileHistorySvc.maxShow = pageSize
        clFileHistorySvc.changeGroups = []
        clFileHistorySvc.hasMore = false
      }

      clFileHistorySvc.showMore = function () {
        clFileHistorySvc.maxShow += pageSize
        refreshChangeGroups()
      }

      return clFileHistorySvc
    })
