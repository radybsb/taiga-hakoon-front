###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

bindOnce = @.taiga.bindOnce

ColorSelectorDirective = ($timeout, $document) ->
    link = (scope, el, attrs, ctrl) ->
        # Animation
        _timeout = null

        cancel = () ->
            $timeout.cancel(_timeout)
            _timeout = null

        outsideClick = (event) ->
            return unless ctrl.displayColorList
            return if el[0].contains(event.target)
            scope.$evalAsync ->
                ctrl.displayColorList = false
                ctrl.resetColor()

        $document.on('click', outsideClick)
        scope.$on '$destroy', ->
            cancel()
            $document.off('click', outsideClick)

        scope.$watch 'vm.initColor', (color) ->
            # We can't just bind once because sometimes the initial color is reset from the outside
            ctrl.setColor(color)

    return {
        link: link,
        templateUrl:"components/color-selector/color-selector.html",
        controller: "ColorSelectorCtrl",
        controllerAs: "vm",
        bindToController: {
            isColorRequired: "=",
            onSelectColor: "&",
            initColor: "=",
            requiredPerm: "@"
        },
        scope: {},
    }


ColorSelectorDirective.$inject = [
    "$timeout", "$document"
]

angular.module('taigaComponents').directive("tgColorSelector", ColorSelectorDirective)
