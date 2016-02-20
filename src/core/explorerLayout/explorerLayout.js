angular.module('classeur.core.explorerLayout', [])
  .directive('clFolderButton',
    function ($window, clExplorerLayoutSvc) {
      return {
        restrict: 'A',
        scope: true,
        link: link
      }

      function link (scope, element, attr) {
        var folderEntryElt = element[0]
        var parentElt = folderEntryElt.parentNode
        var duration
        if (attr.folder) {
          scope.folder = scope.$eval(attr.folder)
        }
        var isHover

        function animate (adjustScrollTop) {
          var isSelected = clExplorerLayoutSvc.currentFolder === scope.folder
          folderEntryElt.classList.toggle('folder-entry--selected', isSelected)
          var y = scope.$index !== undefined ? 129 + scope.$index * 109 : 0
          var z = isSelected ? 10000 : (scope.$index !== undefined ? scope.explorerLayoutSvc.folders.length - scope.$index : 9997)
          folderEntryElt.clanim
            .zIndex(z)
            .start()
            .offsetWidth // Force z-offset to refresh before the animation
          folderEntryElt.clanim
            .duration(duration)
            .translateX(isSelected ? 0 : isHover ? -2 : -5)
            .translateY(y)
            .easing('materialOut')
            .start(true)
          duration = 400
          if (adjustScrollTop && isSelected) {
            // Adjust scrolling position
            var minY = parentElt.scrollTop + 160
            var maxY = parentElt.scrollTop + parentElt.clientHeight - 180
            if (y > maxY) {
              parentElt.scrollTop += y - maxY
            }
            if (y < minY) {
              parentElt.scrollTop += y - minY
            }
          }
        }
        var debounceAnimate = $window.cledit.Utils.debounce(animate, 100)

        folderEntryElt.addEventListener('mouseenter', function () {
          isHover = true
          debounceAnimate()
        })
        folderEntryElt.addEventListener('mouseleave', function () {
          isHover = false
          debounceAnimate()
        })

        scope.$watch('$index', animate)
        scope.$watch('explorerLayoutSvc.currentFolder === folder', function (isSelected) {
          if (isSelected) {
            clExplorerLayoutSvc.currentFolderEntryElt = scope.$index !== undefined && folderEntryElt
            clExplorerLayoutSvc.toggleCurrentFolderEntry()
          }
          animate(true)
        })
      }
    })
  .directive('clFileDropInput',
    function ($window, clToast, clDialog) {
      var maxSize = 200000
      return {
        restrict: 'A',
        link: function (scope, element) {
          function uploadFile (file) {
            var reader = new $window.FileReader()
            reader.onload = function (e) {
              var content = e.target.result
              if (content.match(/\uFFFD/)) {
                return clToast('File is not readable.')
              }
              clDialog.hide({
                name: file.name.slice(0, 128),
                content: content
              })
            }
            var blob = file.slice(0, maxSize)
            reader.readAsText(blob)
          }
          var elt = element[0]
          elt.addEventListener('change', function (evt) {
            var files = evt.target.files
            files[0] && uploadFile(files[0])
          })
          elt.addEventListener('dragover', function (evt) {
            evt.stopPropagation()
            evt.preventDefault()
            evt.dataTransfer.dropEffect = 'copy'
          })
          elt.addEventListener('dragover', function (evt) {
            evt.stopPropagation()
            evt.preventDefault()
            evt.dataTransfer.dropEffect = 'copy'
          })
          elt.addEventListener('drop', function (evt) {
            var files = (evt.dataTransfer || evt.target).files
            if (files[0]) {
              evt.stopPropagation()
              evt.preventDefault()
              uploadFile(files[0])
            }
          })
        }
      }
    })
  .directive('clExplorerLayout',
    function ($window, $timeout, clDialog, clUserSvc, clExplorerLayoutSvc, clFileSvc, clFolderSvc, clClasseurSvc, clToast, clConfig, clPublicSyncSvc, clSettingSvc) {
      var explorerMaxWidth = 760
      var noPaddingWidth = 580
      var hideOffsetY = 2000
      return {
        restrict: 'E',
        templateUrl: 'core/explorerLayout/explorerLayout.html',
        link: link
      }

      function link (scope, element) {
        var explorerInnerElt = element[0].querySelector('.explorer__inner-2')
        var binderElt = element[0].querySelector('.binder').clanim.translateY(20).start()
        var navbarInnerElt = element[0].querySelector('.navbar__inner')
        var binderScrollerElt = element[0].querySelector('.binder__scroller')
        var folderElt = element[0].querySelector('.folder-view--main')
        var folderCloneElt = element[0].querySelector('.folder-view--clone')
        var fileActionsElt = folderElt.querySelector('.file-actions')
        var folderListElt = element[0].querySelector('.folder-list')
        var folderListScrollerElt = folderListElt.querySelector('.folder-list__scroller')
        var createFolderButtonElt = folderListElt.querySelector('.folder-entry--create .folder-entry__inner-1')

        clExplorerLayoutSvc.toggleCurrentFolderEntry = function () {
          folderListElt.classList.toggle('folder-list__show-current', !!clExplorerLayoutSvc.currentFolderEntryElt &&
            clExplorerLayoutSvc.currentFolderEntryElt.getBoundingClientRect().top < createFolderButtonElt.getBoundingClientRect().bottom - 1)
        }

        function toggleFolderCloneElt () {
          folderCloneElt.classList.toggle('folder-view--hidden', folderElt.scrollTop < fileActionsElt.offsetTop)
        }

        folderElt.addEventListener('scroll', toggleFolderCloneElt)
        setTimeout(toggleFolderCloneElt, 1)

        folderListScrollerElt.addEventListener('scroll', clExplorerLayoutSvc.toggleCurrentFolderEntry)

        function updateLayout () {
          var explorerWidth = document.body.clientWidth
          if (explorerWidth > explorerMaxWidth) {
            explorerWidth = explorerMaxWidth
          }
          clExplorerLayoutSvc.explorerWidth = explorerWidth
          clExplorerLayoutSvc.noPadding = explorerWidth < noPaddingWidth
          clExplorerLayoutSvc.binderY = clExplorerLayoutSvc.isExplorerOpen ? 0 : hideOffsetY
        }

        function animateLayout () {
          clExplorerLayoutSvc.scrollbarWidth = folderElt.offsetWidth - folderElt.clientWidth
          updateLayout()
          explorerInnerElt.clanim
            .width(clExplorerLayoutSvc.explorerWidth - 50)
            .translateX(-clExplorerLayoutSvc.explorerWidth / 2 + 5)
            .start()
            .classList.toggle('explorer__inner-2--no-padding', clExplorerLayoutSvc.noPadding)
          navbarInnerElt.clanim
            .width(clExplorerLayoutSvc.explorerWidth)
            .start()
            .classList.toggle('navbar__inner--no-padding', clExplorerLayoutSvc.noPadding)
          binderElt.clanim
            .translateY(clExplorerLayoutSvc.binderY)
            .duration(300)
            .easing(clExplorerLayoutSvc.isExplorerOpen ? 'materialOut' : 'materialIn')
            .start(true)
          var folderContainerWidth = clExplorerLayoutSvc.explorerWidth + clExplorerLayoutSvc.scrollbarWidth
          binderScrollerElt.clanim
            .width(folderContainerWidth)
            .start()
          folderCloneElt.clanim
            .width(folderContainerWidth)
            .start()
        }

        window.addEventListener('resize', animateLayout)
        scope.$on('$destroy', function () {
          window.removeEventListener('resize', animateLayout)
        })

        scope.classeurIndex = 0

        function setPlasticClass () {
          var index = scope.classeurIndex
          if (clExplorerLayoutSvc.currentFolder) {
            if (clExplorerLayoutSvc.currentFolder === clExplorerLayoutSvc.unclassifiedFolder) {
              index++
            } else {
              index += clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolder) + 3
            }
          }
          scope.plasticClass = 'plastic-' + (index % 6)
        }

        scope.folderNameModified = function () {
          clExplorerLayoutSvc.currentFolder.name = clExplorerLayoutSvc.currentFolder.name || 'Untitled'
          clExplorerLayoutSvc.refreshFolders()
          setPlasticClass()
        }

        function makeInputDialog (templateUrl, controller) {
          return clDialog.show({
            templateUrl: templateUrl,
            focusOnOpen: false,
            controller: ['$scope', function (scope) {
              scope.ok = function () {
                if (!scope.value) {
                  return scope.focus()
                }
                clDialog.hide(scope.value)
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
              controller && controller(scope)
            }]
          })
        }

        function importExistingFolder (folder, move) {
          move && clClasseurSvc.daos.cl_each(function (classeur) {
            var index = classeur.folders.indexOf(folder)
            ~index && classeur.folders.splice(index, 1)
          })
          clExplorerLayoutSvc.currentClasseur.folders.push(folder)
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.setCurrentFolder(folder)
          clDialog.cancel()
        }

        function importPublicFolder (folderId) {
          var folder = clFolderSvc.createPublicFolder(folderId)
          // Classeurs are updated when evaluating folderSvc.daos
          clExplorerLayoutSvc.currentClasseur.folders.push(folder)
          $timeout(function () {
            clExplorerLayoutSvc.setCurrentFolder(folder)
          })
          clDialog.cancel()
        }

        function importFolder () {
          makeInputDialog('core/explorerLayout/importFolderDialog.html', function (scope) {
            scope.importType = 'otherUser'
            var classeurFolders = clExplorerLayoutSvc.currentClasseur.folders.cl_reduce(function (classeurFolders, folder) {
              return (classeurFolders[folder.id] = folder, classeurFolders)
            }, {})
            scope.folders = clFolderSvc.daos.cl_filter(function (filterDao) {
              return !filterDao.userId && !classeurFolders.hasOwnProperty(filterDao.id)
            })
            scope.move = true
            var ok = scope.ok
            scope.ok = function () {
              if (scope.importType === 'otherClasseur') {
                if (!scope.folderId) {
                  return clToast('Please select a folder.')
                }
                var folder = clFolderSvc.daoMap[scope.folderId]
                folder && importExistingFolder(folder, scope.move)
                return clDialog.cancel()
              }
              ok()
            }
          }).then(function (link) {
            var components = link.split('/')
            var folderId = components[components.length - 1]
            if (!folderId || link.indexOf(clConfig.appUri) !== 0) {
              clToast('Invalid folder link.')
            }
            if (clExplorerLayoutSvc.currentClasseur.folders
                .cl_some(function (folder) {
                  return folder.id === folderId
                })) {
              clToast('Folder is already in the classeur.')
            }
            var folder = clFolderSvc.daoMap[folderId]
            folder ? importExistingFolder(folder) : importPublicFolder(folderId)
          })
        }

        function createFolder () {
          makeInputDialog('core/explorerLayout/newFolderDialog.html', function (scope) {
            scope.import = function () {
              clDialog.cancel()
              importFolder()
            }
          }).then(function (name) {
            var folder = clFolderSvc.createFolder()
            folder.name = name
            // Classeurs are updated when evaluating folderSvc.daos
            clExplorerLayoutSvc.currentClasseur.folders.push(folder)
            $timeout(function () {
              clExplorerLayoutSvc.setCurrentFolder(folder)
            })
          })
        }

        function importFile () {
          var classeur = clExplorerLayoutSvc.currentClasseur
          var folder = clExplorerLayoutSvc.currentFolder
          clDialog.show({
            templateUrl: 'core/explorerLayout/importFileDialog.html',
            controller: ['$scope', function (scope) {
              scope.cancel = function () {
                clDialog.cancel()
              }
            }]
          })
            .then(function (file) {
              var newFileDao = clFileSvc.createFile()
              newFileDao.state = 'loaded'
              newFileDao.readContent()
              newFileDao.name = file.name
              newFileDao.content.text = file.content
              newFileDao.content.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folder && clFolderSvc.daoMap[folder.id]) {
                newFileDao.folderId = folder.id
                newFileDao.userId = folder.userId
                if (folder.userId) {
                  newFileDao.sharing = folder.sharing
                }
              } else {
                newFileDao.classeurId = classeur.id
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        scope.createFile = function () {
          var classeur = clExplorerLayoutSvc.currentClasseur
          var folder = clExplorerLayoutSvc.currentFolder
          makeInputDialog('core/explorerLayout/newFileDialog.html', function (scope) {
            scope.import = function () {
              clDialog.cancel()
              importFile()
            }
          })
            .then(function (name) {
              var newFileDao = clFileSvc.createFile()
              newFileDao.state = 'loaded'
              newFileDao.readContent()
              newFileDao.name = name
              newFileDao.content.properties = clSettingSvc.values.defaultFileProperties || {}
              newFileDao.writeContent()
              if (folder && clFolderSvc.daoMap[folder.id]) {
                newFileDao.folderId = folder.id
                newFileDao.userId = folder.userId
                if (folder.userId) {
                  newFileDao.sharing = folder.sharing
                }
              } else {
                newFileDao.classeurId = classeur.id
              }
              scope.setCurrentFile(newFileDao)
            })
        }

        // setInterval(function() {
        // 	var file = clFileSvc.createFile()
        // 	file.name = 'File ' + file.id
        // 	file.folderId = clFolderSvc.daos[Math.random() * clFolderSvc.daos.length | 0].id
        // 	scope.$apply()
        // }, 1000)

        // setInterval(function() {
        // 	var folder = clFolderSvc.createFolder()
        // 	folder.name = 'Folder ' + folder.id
        // 	clExplorerLayoutSvc.currentClasseur.folders.push(folder)
        // 	scope.$apply()
        // }, 15000)

        scope.setFolder = function (folder) {
          if (folder === clExplorerLayoutSvc.createFolder) {
            return createFolder()
          }
          clExplorerLayoutSvc.setCurrentFolder(folder)
        }

        scope.selectAll = function () {
          var doAll = true
          clExplorerLayoutSvc.files.cl_each(function (file) {
            if (!file.isSelected) {
              doAll = false
              file.isSelected = true
            }
          })
          doAll && clExplorerLayoutSvc.extraFiles.cl_each(function (file) {
            file.isSelected = true
          })
        }

        scope.selectNone = function () {
          clExplorerLayoutSvc.selectedFiles.cl_each(function (file) {
            file.isSelected = false
          })
        }

        scope.sortByDate = function (value) {
          clExplorerLayoutSvc.isSortedByDate = value
          clExplorerLayoutSvc.moreFiles(true)
          clExplorerLayoutSvc.refreshFiles()
          folderElt.scrollTop = 0
        }

        ;(function () {
          var filesToRemove, folderToRemove

          function remove () {
            clFileSvc.setDeletedFiles(filesToRemove)
            if (folderToRemove && clFolderSvc.setDeletedFolder(folderToRemove) >= 0) {
              var newIndex = clExplorerLayoutSvc.folders.indexOf(folderToRemove) - 1
              var currentFolder = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder
              clExplorerLayoutSvc.setCurrentFolder(currentFolder)
            }
          }

          function deleteConfirm () {
            if (!filesToRemove.length) {
              // No confirmation
              return remove()
            }
            var title = folderToRemove ? 'Delete folder' : 'Delete files'
            var confirm = clDialog.confirm()
              .title(title)
              .ariaLabel(title)
              .content("You're about to delete " + filesToRemove.length + ' file(s). Are you sure?')
              .ok('Yes')
              .cancel('No')
            clDialog.show(confirm).then(remove)
          }

          scope.deleteFile = function (file) {
            folderToRemove = null
            filesToRemove = [file]
            deleteConfirm()
          }

          scope.deleteConfirm = function (deleteFolder) {
            folderToRemove = null
            if (deleteFolder) {
              folderToRemove = clExplorerLayoutSvc.currentFolder
              !clExplorerLayoutSvc.currentFolder.userId && scope.selectAll()
            }
            clExplorerLayoutSvc.updateSelectedFiles() // updateSelectedFiles is called automatically but later
            filesToRemove = clExplorerLayoutSvc.selectedFiles
            deleteConfirm()
          }
        })()

        scope.isFolderInOtherClasseur = function () {
          return clClasseurSvc.daos.cl_some(function (classeur) {
            return classeur !== clExplorerLayoutSvc.currentClasseur && ~classeur.folders.indexOf(clExplorerLayoutSvc.currentFolder)
          })
        }

        scope.removeFolderFromClasseur = function () {
          if (clExplorerLayoutSvc.currentFolder.userId && !scope.isFolderInOtherClasseur()) {
            clFolderSvc.removeDaos([clExplorerLayoutSvc.currentFolder])
          } else {
            clExplorerLayoutSvc.currentClasseur.folders = clExplorerLayoutSvc.currentClasseur.folders.cl_filter(function (folderInClasseur) {
              return folderInClasseur.id !== clExplorerLayoutSvc.currentFolder.id
            })
          }
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        }

        scope.createClasseur = function () {
          makeInputDialog('core/explorerLayout/newClasseurDialog.html')
            .then(function (name) {
              var classeur = clClasseurSvc.createClasseur(name)
              scope.setClasseur(classeur)
            })
        }

        scope.deleteClasseur = function (classeur) {
          var filesToRemove = []
          var foldersToRemove = classeur.folders.cl_filter(function (folder) {
            if (!clClasseurSvc.daos
                .cl_some(function (otherClasseurDao) {
                  return otherClasseurDao !== classeur && ~otherClasseurDao.folders.indexOf(folder)
                })) {
              filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.cl_filter(function (file) {
                return file.folderId === folder.id
              }))
              return true
            }
          })

          function remove () {
            clClasseurSvc.setDeletedClasseurs([classeur])
          }

          if (!foldersToRemove.length) {
            return remove()
          }

          clDialog.show({
            templateUrl: 'core/explorerLayout/deleteClasseurDialog.html',
            onComplete: function (scope) {
              scope.remove = function () {
                clFileSvc.setDeletedFiles(filesToRemove)
                clFolderSvc.setDeletedFolders(foldersToRemove)
                clDialog.hide()
              }
              scope.move = function () {
                clDialog.hide()
              }
              scope.cancel = function () {
                clDialog.cancel()
              }
            }
          }).then(remove)
        }

        scope.setClasseur = function (classeur) {
          folderListScrollerElt.scrollTop = 0
          clExplorerLayoutSvc.setCurrentClasseur(classeur)
          clExplorerLayoutSvc.setCurrentFolder(classeur.lastFolder)
          clExplorerLayoutSvc.refreshFolders()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        scope.signout = function () {
          clUserSvc.signout()
          clExplorerLayoutSvc.toggleExplorer(true)
        }

        function refreshFiles () {
          folderElt.scrollTop = 0
          clExplorerLayoutSvc.moreFiles(true)
          clExplorerLayoutSvc.refreshFiles()
          scope.selectNone()
        }

        scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout)
        scope.$watch('fileSvc.daos', clExplorerLayoutSvc.refreshFiles)
        scope.$watch('folderSvc.daos', function () {
          clClasseurSvc.init()
          clExplorerLayoutSvc.refreshFolders()
        })
        scope.$watchGroup(['classeurSvc.daos', 'classeurSvc.daos.length'], function () {
          clExplorerLayoutSvc.refreshFolders()
          scope.classeurIndex = clClasseurSvc.daos.indexOf(clExplorerLayoutSvc.currentClasseur)
        })
        scope.$watchGroup(['explorerLayoutSvc.currentClasseur', 'explorerLayoutSvc.currentFolder'], function () {
          scope.userInputFilter = undefined
          refreshFiles()
          scope.classeurIndex = clClasseurSvc.daos.indexOf(clExplorerLayoutSvc.currentClasseur)
          setPlasticClass()
          clPublicSyncSvc.getFolder(clExplorerLayoutSvc.currentFolder)
        })
        scope.$watch('userInputFilter', function (value) {
          clExplorerLayoutSvc.setUserInputFilter(value)
          refreshFiles()
        })
        scope.$watch('explorerLayoutSvc.files', scope.triggerInfiniteScroll)
        scope.$watch('explorerLayoutSvc.currentFolder.sharing', clExplorerLayoutSvc.setEffectiveSharing)

        // Refresh selectedFiles on every digest and add 1 cycle when length changes
        scope.$watch('explorerLayoutSvc.updateSelectedFiles().length', function () {})

        scope.$on('$destroy', function () {
          clExplorerLayoutSvc.clean()
        })
      }
    })
  .factory('clExplorerLayoutSvc',
    function ($rootScope, clLocalStorage, clFolderSvc, clFileSvc, clClasseurSvc) {
      var pageSize = 20
      var lastClasseurKey = 'lastClasseurId'
      var lastFolderKey = 'lastFolderId'
      var unclassifiedFolder = {
        id: 'unclassified',
        name: 'My files'
      }
      var createFolder = {
        id: 'create',
        name: 'Create folder'
      }

      var endFileIndex, userInputFilter

      function moreFiles (reset) {
        if (reset) {
          endFileIndex = 0
        }
        if (endFileIndex < clExplorerLayoutSvc.files.length + clExplorerLayoutSvc.extraFiles.length) {
          endFileIndex += pageSize
          clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex)
          clExplorerLayoutSvc.pagedExtraFiles = clExplorerLayoutSvc.extraFiles.slice(0, endFileIndex - clExplorerLayoutSvc.pagedFiles.length)
          return true
        }
      }

      function inputFilter (file) {
        return !userInputFilter || ~file.name.toLowerCase().indexOf(userInputFilter)
      }

      function currentUserFilter (file) {
        return !file.userId
      }

      function currentFolderFilter (file) {
        return file.folderId === clExplorerLayoutSvc.currentFolder.id
      }

      function refreshFiles () {
        var filters = []
        var files = clFileSvc.daos
        var extraFiles = []

        function currentClasseurFilter (file) {
          var result = clExplorerLayoutSvc.currentClasseur.isDefault
          var classeur = clClasseurSvc.daoMap[file.classeurId]
          if (classeur) {
            result = classeur === clExplorerLayoutSvc.currentClasseur
          } else if (clFolderSvc.daoMap[file.folderId]) {
            result = clExplorerLayoutSvc.currentClasseur.folders.cl_some(function (folder) {
              return folder.id === file.folderId
            })
          }
          !result && extraFiles.push(file)
          return result
        }

        if (clExplorerLayoutSvc.currentFolder === unclassifiedFolder) {
          filters.push(currentUserFilter)
          filters.push(inputFilter)
          filters.push(currentClasseurFilter)
        } else if (clExplorerLayoutSvc.currentFolder) {
          filters.push(currentFolderFilter)
          filters.push(inputFilter)
        } else {
          files = clFileSvc.localFiles
          filters.push(inputFilter)
          filters.push(currentClasseurFilter)
        }
        filters.cl_each(function (filter) {
          files = files.cl_filter(filter)
        })

        var sort
        if (!clExplorerLayoutSvc.currentFolder) {
          // Sort by local content change (recent files)
          sort = function (file1, file2) {
            return file2.content.lastChange - file1.content.lastChange
          }
        } else if (clExplorerLayoutSvc.isSortedByDate) {
          // Sort by server change
          sort = function (file1, file2) {
            return file2.updated - file1.updated
          }
        } else {
          // Sort by name
          sort = function (file1, file2) {
            return file1.name.localeCompare(file2.name)
          }
        }
        clExplorerLayoutSvc.files = files.sort(sort)
        clExplorerLayoutSvc.extraFiles = extraFiles.sort(sort)
        clExplorerLayoutSvc.pagedFiles = clExplorerLayoutSvc.files.slice(0, endFileIndex)
        clExplorerLayoutSvc.pagedExtraFiles = clExplorerLayoutSvc.extraFiles.slice(0, endFileIndex - clExplorerLayoutSvc.pagedFiles.length)
        setEffectiveSharing()
      }

      function setUserInputFilter (value) {
        if (userInputFilter !== value) {
          userInputFilter = value && value.toLowerCase()
          refreshFiles()
        }
      }

      function updateSelectedFiles () {
        clExplorerLayoutSvc.selectedFiles = clExplorerLayoutSvc.files.cl_filter(function (file) {
          return file.isSelected
        }).concat(clExplorerLayoutSvc.extraFiles.cl_filter(function (file) {
          return file.isSelected
        }))
        return clExplorerLayoutSvc.selectedFiles
      }

      function setEffectiveSharing () {
        if (clExplorerLayoutSvc.currentFolder) {
          clExplorerLayoutSvc.currentFolder.effectiveSharing = clExplorerLayoutSvc.currentFolder.sharing
        }
        clExplorerLayoutSvc.files.concat(clExplorerLayoutSvc.extraFiles).cl_each(function (file) {
          file.effectiveSharing = file.sharing
          var folder = clFolderSvc.daoMap[file.folderId]
          if (folder && folder.sharing > file.sharing) {
            file.effectiveSharing = folder.sharing
          }
        })
      }

      function refreshFolders () {
        setCurrentClasseur(clExplorerLayoutSvc.currentClasseur)
        setCurrentFolder(clExplorerLayoutSvc.currentFolder)
        clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseur.folders.slice().sort(function (folder1, folder2) {
          return folder1.name.localeCompare(folder2.name)
        })
      }

      function setCurrentClasseur (classeur) {
        classeur = (classeur && clClasseurSvc.daoMap[classeur.id]) || clClasseurSvc.defaultClasseur
        clExplorerLayoutSvc.currentClasseur = classeur
        clLocalStorage.setItem(lastClasseurKey, classeur.id)
      }

      function setCurrentFolder (folder) {
        folder = folder === unclassifiedFolder ? folder : (folder && clFolderSvc.daoMap[folder.id])
        if (folder && folder !== unclassifiedFolder && ~clExplorerLayoutSvc.currentClasseur.folders.indexOf(folder)) {
          folder = undefined
        }
        clExplorerLayoutSvc.currentFolder = folder
        clExplorerLayoutSvc.currentClasseur.lastFolder = folder
        folder && folder.id ? clLocalStorage.setItem(lastFolderKey, folder.id) : clLocalStorage.removeItem(lastFolderKey)
      }

      function setCurrentFolderInClasseur (folder) {
        if (!clClasseurSvc.daos
            .cl_some(function (classeur) {
              if (~classeur.folders.indexOf(folder)) {
                setCurrentClasseur(classeur)
                return true
              }
            })) {
          setCurrentClasseur(clClasseurSvc.defaultClasseur)
        }
        setCurrentFolder(folder)
        clExplorerLayoutSvc.refreshFolders()
      }

      var clExplorerLayoutSvc = {
        scrollbarWidth: 0,
        folders: [],
        files: [],
        extraFiles: [],
        selectedFiles: [],
        unclassifiedFolder: unclassifiedFolder,
        createFolder: createFolder,
        refreshFolders: refreshFolders,
        refreshFiles: refreshFiles,
        moreFiles: moreFiles,
        setUserInputFilter: setUserInputFilter,
        updateSelectedFiles: updateSelectedFiles,
        setEffectiveSharing: setEffectiveSharing,
        setCurrentClasseur: setCurrentClasseur,
        setCurrentFolder: setCurrentFolder,
        setCurrentFolderInClasseur: setCurrentFolderInClasseur,
        init: function () {
          this.isExplorerOpen = true
        },
        clean: function () {
          clExplorerLayoutSvc.sharingDialogFileDao = undefined
        },
        toggleExplorer: function (isOpen) {
          this.isExplorerOpen = isOpen === undefined ? !this.isExplorerOpen : isOpen
        }
      }

      setCurrentClasseur(clClasseurSvc.daoMap[clLocalStorage[lastClasseurKey]])
      setCurrentFolder(clFolderSvc.daoMap[clLocalStorage[lastFolderKey]])
      moreFiles(true)

      return clExplorerLayoutSvc
    })
