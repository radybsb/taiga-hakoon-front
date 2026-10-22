###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

BoardZoomDirective = ($document) ->
    return {
        scope: {
            levels: "=",
            value: "="
        },
        templateUrl: 'components/board-zoom/board-zoom.html'
        link: (scope, element) ->
            scope.zoomOptions = ['0', '1', '2', '3']
            scope.selectZoom = (option) ->
                scope.value = option
                scope.zoomOpen = false
                element[0].querySelector('.board-zoom-trigger').focus()
            outsideClick = (event) ->
                if scope.zoomOpen && !element[0].contains(event.target)
                    scope.$evalAsync -> scope.zoomOpen = false
            escape = (event) ->
                if event.key == 'Escape' && scope.zoomOpen
                    scope.$evalAsync -> scope.zoomOpen = false
                    element[0].querySelector('.board-zoom-trigger').focus()
            $document.on('click', outsideClick)
            element.on('keydown', escape)
            scope.$on '$destroy', ->
                $document.off('click', outsideClick)
                element.off('keydown', escape)
    }

angular.module('taigaComponents').directive("tgBoardZoom", ['$document', BoardZoomDirective])
